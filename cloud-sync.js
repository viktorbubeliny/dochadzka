"use strict";

/* ---------- Supabase cloud sync ---------- */
/* Prihlásenie cez magic link (email). Dáta = jeden riadok na používateľa v tabuľke `backups`.
   Logika: čas poslednej synchronizácie (cloud_synced_at) + príznak neodoslaných zmien (cloud_dirty).
   - nič nové vzdialene          -> nič sa nedeje
   - vzdialene novšie, lokálne čisté -> lokálny stav sa NAHRADÍ vzdialeným (vrátane zmazaných dní)
   - prvé pripojenie / konflikt  -> zjednotenie oboch stavov a odoslanie */

const SUPABASE_URL = "https://hboszfmppcvzxbfdrnyt.supabase.co";
const SUPABASE_KEY = "sb_publishable_vYURF3EhA-SI_j5oIirSNg_D5fCmeyZ";
const K_SYNCED = "cloud_synced_at";
const K_DIRTY = "cloud_dirty";

const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Lokálna vrstva pre Prehľad (React bundle) - rovnaké localStorage kľúče ako predtým.
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
let isPushing = false;
let isPulling = false;

function scheduleCloudPush() {
  if (window.__suppressPush) return;
  localStorage.setItem(K_DIRTY, "1");
  clearTimeout(pushTimer);
  pushTimer = setTimeout(doCloudPush, 1500);
}
window.__scheduleCloudPush = scheduleCloudPush;

function deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}
const core = (o) => ({ dochadzka: o.dochadzka || [], prehlad: o.prehlad || {} });

async function doCloudPush() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session || !window.__buildBackupObject) return false;
  isPushing = true;
  try {
    localStorage.setItem(K_DIRTY, "0"); // nová zmena počas odosielania ho nastaví späť na 1
    const { data, error } = await sbClient
      .from("backups")
      .upsert({ user_id: session.user.id, data: window.__buildBackupObject(), updated_at: new Date().toISOString() })
      .select("updated_at")
      .single();
    if (error) { console.error("cloud push error", error); localStorage.setItem(K_DIRTY, "1"); return false; }
    localStorage.setItem(K_SYNCED, data.updated_at);
    setLastSync(new Date());
    return true;
  } finally {
    isPushing = false;
  }
}

async function pullAndMerge(opts = {}) {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session || isPulling || isPushing) return;
  isPulling = true;
  try {
    const { data: row, error } = await sbClient
      .from("backups")
      .select("data, updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) { console.error("cloud pull error", error); return; }

    // žiadna cloudová záloha zatiaľ -> nahraj lokálne dáta
    if (!row) {
      if (window.__hasLocalData && window.__hasLocalData()) await doCloudPush();
      setLastSync(new Date());
      return;
    }

    const synced = localStorage.getItem(K_SYNCED);
    const dirty = localStorage.getItem(K_DIRTY) === "1";

    if (row.updated_at === synced) {
      if (dirty) scheduleCloudPush();
      setLastSync(new Date());
      return;
    }

    if (synced && !dirty) {
      // vzdialená zmena z iného zariadenia, lokálne nič neodoslané -> prevezmi vzdialený stav
      window.__replaceWithBackup(row.data);
      localStorage.setItem(K_SYNCED, row.updated_at);
      if (!opts.silent && window.toast) window.toast("Nové dáta z iného zariadenia - appka sa obnoví");
      setTimeout(() => location.reload(), 600);
      return;
    }

    // prvé pripojenie tohto zariadenia alebo konflikt -> zjednotenie a odoslanie
    const changed = window.__mergeRemoteBackup(row.data);
    const remoteCore = core(row.data || {});
    const localCore = core(window.__buildBackupObject());
    if (!deepEqual(localCore, remoteCore)) {
      await doCloudPush();
    } else {
      localStorage.setItem(K_SYNCED, row.updated_at);
      localStorage.setItem(K_DIRTY, "0");
    }
    if (changed) {
      if (window.toast) window.toast("Dáta zlúčené - appka sa obnoví");
      setTimeout(() => location.reload(), 600);
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

// Odkaz z emailu vo formáte ?token_hash=...&type=email - funguje v ktoromkoľvek prehliadači/appke.
async function handleEmailLinkIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (!tokenHash) return false;
  const statusEl = document.getElementById("authStatus");
  if (statusEl) statusEl.textContent = "Prihlasujem…";
  let error = null;
  try {
    ({ error } = await sbClient.auth.verifyOtp({ token_hash: tokenHash, type: type || "email" }));
  } catch (e) {
    error = e;
  }
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
      // odložene, aby sme nevolali Supabase API priamo vnútri callbacku
      setTimeout(() => { subscribeRealtime(session.user.id); pullAndMerge(); }, 0);
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
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
      btnSend.disabled = false;
      if (error) { statusEl.textContent = "Chyba: " + error.message; return; }
      statusEl.textContent = "Odkaz poslaný na " + email + " - skontroluj si email (aj spam).";
    });
  }

  const btnSignOut = document.getElementById("btnSignOut");
  if (btnSignOut) btnSignOut.addEventListener("click", async () => { await sbClient.auth.signOut(); });

  const btnSyncNow = document.getElementById("btnSyncNow");
  if (btnSyncNow) btnSyncNow.addEventListener("click", () => pullAndMerge());
});
