"use strict";

/* ---------- Supabase cloud sync ---------- */
/* Nahrádza pôvodný GitHub Gist sync. Prihlásenie cez magic link (email),
   dáta sa ukladajú do tabuľky `backups` (jeden riadok na používateľa),
   automatický push po zmene + realtime pull keď sa zmenia na inom zariadení. */

const SUPABASE_URL = "https://hboszfmppcvzxbfdrnyt.supabase.co";
const SUPABASE_KEY = "sb_publishable_vYURF3EhA-SI_j5oIirSNg_D5fCmeyZ";

const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Lokálna vrstva pre Prehľad (React bundle) - rovnaké localStorage kľúče ako
// predtým (prehlad_entries, prehlad_allowances), len navyše spúšťa cloud push.
window.storage = {
  async get(key) {
    return { value: localStorage.getItem("prehlad_" + key) };
  },
  async set(key, value) {
    localStorage.setItem("prehlad_" + key, value);
    scheduleCloudPush();
    return true;
  }
};

let pushTimer = null;
function scheduleCloudPush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(doCloudPush, 1500);
}
window.__scheduleCloudPush = scheduleCloudPush;

async function doCloudPush() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session || !window.__buildBackupObject) return;
  const payload = window.__buildBackupObject();
  const { error } = await sbClient
    .from("backups")
    .upsert({ user_id: session.user.id, data: payload, updated_at: new Date().toISOString() });
  if (error) { console.error("cloud push error", error); return; }
  setLastSync(new Date());
}

let isPulling = false;
async function pullAndMerge(opts = {}) {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session || isPulling) return;
  isPulling = true;
  try {
    const { data, error } = await sbClient
      .from("backups")
      .select("data, updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) { console.error("cloud pull error", error); return; }
    if (data && data.data && window.__applyRemoteBackupIfChanged) {
      const changed = window.__applyRemoteBackupIfChanged(data.data);
      if (changed) {
        if (!opts.silent && window.toast) window.toast("Nové dáta z iného zariadenia - appka sa obnoví");
        setTimeout(() => location.reload(), 800);
      }
    }
    setLastSync(new Date());
  } finally {
    isPulling = false;
  }
}

function setLastSync(d) {
  const el = document.getElementById("lastSyncTime");
  if (el) el.textContent = d.toLocaleString("sk-SK");
}

function showApp(session) {
  const overlay = document.getElementById("authOverlay");
  const root = document.getElementById("appRoot");
  if (overlay) overlay.hidden = true;
  if (root) root.hidden = false;
  const emailEl = document.getElementById("accountEmail");
  if (emailEl) emailEl.textContent = session.user.email;
}

function showAuthOverlay() {
  const overlay = document.getElementById("authOverlay");
  const root = document.getElementById("appRoot");
  if (overlay) overlay.hidden = false;
  if (root) root.hidden = true;
}

let realtimeChannel = null;
function subscribeRealtime(userId) {
  if (realtimeChannel) { sbClient.removeChannel(realtimeChannel); realtimeChannel = null; }
  realtimeChannel = sbClient
    .channel("backups-" + userId)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "backups", filter: `user_id=eq.${userId}` },
      () => pullAndMerge({ silent: true })
    )
    .subscribe();
}

// Odkaz z emailu vo formáte ?token_hash=...&type=email - funguje nezávisle od toho,
// v akom prehliadači/appke (napr. Mail appka na iPhone) sa odkaz otvorí, na rozdiel
// od pôvodného PKCE ?code= formátu, ktorý vyžaduje presne ten istý prehliadač.
async function handleEmailLinkIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (!tokenHash) return false;
  const statusEl = document.getElementById("authStatus");
  if (statusEl) statusEl.textContent = "Prihlasujem…";
  const { error } = await sbClient.auth.verifyOtp({ token_hash: tokenHash, type: type || "email" });
  // odstráň token z URL, nech nezostane v histórii/pri obnovení stránky
  window.history.replaceState({}, document.title, window.location.pathname);
  if (error) {
    console.error("verifyOtp error", error);
    if (statusEl) statusEl.textContent = "Prihlásenie zlyhalo: " + error.message;
    return false;
  }
  return true;
}

async function initAuth() {
  await handleEmailLinkIfPresent();
  const { data: { session } } = await sbClient.auth.getSession();
  if (session) {
    showApp(session);
    subscribeRealtime(session.user.id);
    pullAndMerge();
  } else {
    showAuthOverlay();
  }

  sbClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
      showApp(session);
      subscribeRealtime(session.user.id);
      pullAndMerge();
    } else if (event === "SIGNED_OUT") {
      if (realtimeChannel) { sbClient.removeChannel(realtimeChannel); realtimeChannel = null; }
      showAuthOverlay();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAuth();

  const btnSend = document.getElementById("btnSendMagicLink");
  if (btnSend) {
    btnSend.addEventListener("click", async () => {
      const emailEl = document.getElementById("authEmail");
      const statusEl = document.getElementById("authStatus");
      const email = (emailEl.value || "").trim();
      if (!email) { statusEl.textContent = "Zadaj email."; return; }
      statusEl.textContent = "Posielam odkaz…";
      btnSend.disabled = true;
      const { error } = await sbClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href }
      });
      btnSend.disabled = false;
      if (error) { statusEl.textContent = "Chyba: " + error.message; return; }
      statusEl.textContent = "Odkaz poslaný na " + email + " - skontroluj si email a otvor ho na tomto zariadení.";
    });
  }

  const btnSignOut = document.getElementById("btnSignOut");
  if (btnSignOut) {
    btnSignOut.addEventListener("click", async () => {
      await sbClient.auth.signOut();
    });
  }

  const btnSyncNow = document.getElementById("btnSyncNow");
  if (btnSyncNow) {
    btnSyncNow.addEventListener("click", () => pullAndMerge());
  }
});
