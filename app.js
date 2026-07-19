"use strict";

const STORAGE_KEY = "dochadzka_entries_v1";

/* ---------- utils ---------- */

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function pad(n) { return String(n).padStart(2, "0"); }

function dateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ---------- storage ---------- */

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("load error", e);
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

let entries = loadEntries();

function persist() {
  saveEntries(entries);
  renderAll();
}

/* ---------- core logic ---------- */

function getOpenEntry() {
  return entries.find((e) => e.checkOut === null) || null;
}

function doCheckIn() {
  if (getOpenEntry()) { toast("Už máš otvorený príchod"); return; }
  const now = new Date();
  entries.push({
    id: uuid(),
    date: dateStr(now),
    checkIn: now.toISOString(),
    checkOut: null,
    note: ""
  });
  persist();
  toast("Príchod zaznamenaný");
}

function doCheckOut() {
  const open = getOpenEntry();
  if (!open) { toast("Nemáš otvorený príchod"); return; }
  open.checkOut = new Date().toISOString();
  persist();
  toast("Odchod zaznamenaný");
}

function deleteEntry(id) {
  entries = entries.filter((e) => e.id !== id);
  persist();
}

function upsertManual({ id, date, inTime, outTime, note }) {
  const checkIn = new Date(`${date}T${inTime}:00`).toISOString();
  const checkOut = outTime ? new Date(`${date}T${outTime}:00`).toISOString() : null;
  if (id) {
    const e = entries.find((x) => x.id === id);
    if (e) { e.date = date; e.checkIn = checkIn; e.checkOut = checkOut; e.note = note || ""; }
  } else {
    entries.push({ id: uuid(), date, checkIn, checkOut, note: note || "" });
  }
  persist();
}

/* ---------- grouping / totals ---------- */

function entriesByDate() {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  for (const list of map.values()) list.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return map;
}

function dayDurationMs(dayEntries) {
  return dayEntries.reduce((sum, e) => {
    const start = new Date(e.checkIn).getTime();
    const end = e.checkOut ? new Date(e.checkOut).getTime() : Date.now();
    return sum + Math.max(0, end - start);
  }, 0);
}

function totalInRange(fromDate, toDate) {
  let sum = 0;
  const map = entriesByDate();
  for (const [date, list] of map) {
    const d = new Date(date + "T00:00:00");
    if (d >= fromDate && d <= toDate) sum += dayDurationMs(list);
  }
  return sum;
}

/* ---------- rendering ---------- */

function renderStatus() {
  const open = getOpenEntry();
  const statusText = document.getElementById("statusText");
  const statusSub = document.getElementById("statusSub");
  const btnIn = document.getElementById("btnCheckIn");
  const btnOut = document.getElementById("btnCheckOut");

  if (open) {
    statusText.textContent = "V práci";
    statusSub.textContent = `Príchod o ${timeStr(new Date(open.checkIn))}`;
    btnIn.hidden = true;
    btnOut.hidden = false;
  } else {
    statusText.textContent = "Mimo práce";
    const today = entriesByDate().get(dateStr(new Date())) || [];
    const worked = dayDurationMs(today);
    statusSub.textContent = today.length ? `Dnes odpracované: ${formatDuration(worked)}` : "Zatiaľ žiadny záznam dnes";
    btnIn.hidden = false;
    btnOut.hidden = true;
  }
}

function renderToday() {
  const list = document.getElementById("todayEntries");
  const today = dateStr(new Date());
  const todays = (entriesByDate().get(today) || []).slice().reverse();
  list.innerHTML = "";
  if (!todays.length) {
    list.innerHTML = `<li class="empty">Zatiaľ žiadne záznamy</li>`;
    return;
  }
  for (const e of todays) {
    list.appendChild(renderEntryItem(e));
  }
}

function renderEntryItem(e) {
  const li = document.createElement("li");
  li.className = "entry-item";
  const start = new Date(e.checkIn);
  const end = e.checkOut ? new Date(e.checkOut) : null;
  const dur = dayDurationMs([e]);
  li.innerHTML = `
    <div>
      <div class="times">${timeStr(start)} – ${end ? timeStr(end) : "prebieha"}</div>
      ${e.note ? `<span class="note">${escapeHtml(e.note)}</span>` : ""}
    </div>
    <div class="duration">${formatDuration(dur)}</div>
  `;
  li.addEventListener("click", () => openEditDialog(e));
  return li;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderHistory() {
  const list = document.getElementById("historyList");
  const map = entriesByDate();
  const dates = [...map.keys()].sort().reverse();
  list.innerHTML = "";
  if (!dates.length) {
    list.innerHTML = `<li class="empty">Žiadna história</li>`;
  } else {
    for (const date of dates) {
      const dayEntries = map.get(date);
      const dur = dayDurationMs(dayEntries);
      const li = document.createElement("li");
      li.className = "history-day";
      const d = new Date(date + "T00:00:00");
      const label = d.toLocaleDateString("sk-SK", { weekday: "short", day: "numeric", month: "short" });
      li.innerHTML = `
        <div>
          <span class="date-label">${label}</span>
          <div class="times">${dayEntries.map(e => `${timeStr(new Date(e.checkIn))}–${e.checkOut ? timeStr(new Date(e.checkOut)) : "?"}`).join(", ")}</div>
        </div>
        <div class="duration">${formatDuration(dur)}</div>
      `;
      li.addEventListener("click", () => openEditDialog(dayEntries[0]));
      list.appendChild(li);
    }
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(); weekEnd.setHours(23, 59, 59, 999);
  document.getElementById("weekTotal").textContent = formatDuration(totalInRange(weekStart, weekEnd));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  document.getElementById("monthTotal").textContent = formatDuration(totalInRange(monthStart, weekEnd));
}

function renderClock() {
  document.getElementById("clock").textContent = new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
}

function renderAll() {
  renderStatus();
  renderToday();
  renderHistory();
}

/* ---------- edit dialog ---------- */

const dialog = document.getElementById("editDialog");
let editingId = null;

function openEditDialog(entry) {
  editingId = entry.id;
  document.getElementById("editDate").value = entry.date;
  document.getElementById("editIn").value = timeStr(new Date(entry.checkIn));
  document.getElementById("editOut").value = entry.checkOut ? timeStr(new Date(entry.checkOut)) : "";
  document.getElementById("editNote").value = entry.note || "";
  dialog.showModal();
}

function openManualDialog() {
  editingId = null;
  const now = new Date();
  document.getElementById("editDate").value = dateStr(now);
  document.getElementById("editIn").value = timeStr(now);
  document.getElementById("editOut").value = "";
  document.getElementById("editNote").value = "";
  dialog.showModal();
}

document.getElementById("editForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const date = document.getElementById("editDate").value;
  const inTime = document.getElementById("editIn").value;
  const outTime = document.getElementById("editOut").value;
  const note = document.getElementById("editNote").value;
  if (!date || !inTime) { toast("Vyplň dátum a čas príchodu"); return; }
  upsertManual({ id: editingId, date, inTime, outTime, note });
  dialog.close();
  toast("Uložené");
});

document.getElementById("editCancel").addEventListener("click", () => dialog.close());
document.getElementById("editDelete").addEventListener("click", () => {
  if (editingId) deleteEntry(editingId);
  dialog.close();
});

/* ---------- export / import ---------- */

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const rows = [["Dátum", "Príchod", "Odchod", "Trvanie (h)", "Poznámka"]];
  const map = entriesByDate();
  const dates = [...map.keys()].sort();
  for (const date of dates) {
    for (const e of map.get(date)) {
      const dur = dayDurationMs([e]) / 3600000;
      rows.push([
        date,
        timeStr(new Date(e.checkIn)),
        e.checkOut ? timeStr(new Date(e.checkOut)) : "",
        dur.toFixed(2),
        e.note || ""
      ]);
    }
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadFile(`dochadzka-${dateStr(new Date())}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
}

function safeParseLS(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Jedna spoločná záloha pre obe časti appky: Dnes/História (dochádzka)
// aj Prehľad (dovolenka/služby, ukladané pod kľúčmi prehlad_*).
function exportJson() {
  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    dochadzka: entries,
    prehlad: {
      entries: safeParseLS("prehlad_entries") || {},
      allowances: safeParseLS("prehlad_allowances") || null
    }
  };
  downloadFile(`dochadzka-zaloha-${dateStr(new Date())}.json`, JSON.stringify(backup, null, 2), "application/json");
  toast("Záloha stiahnutá");
}

function importDochadzka(incoming) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  let added = 0, updated = 0;
  for (const e of incoming) {
    if (!e.id || !e.date || !e.checkIn) continue;
    if (byId.has(e.id)) {
      const existing = byId.get(e.id);
      const existingHasOut = !!existing.checkOut;
      const incomingHasOut = !!e.checkOut;
      if (incomingHasOut && !existingHasOut) { Object.assign(existing, e); updated++; }
    } else {
      entries.push(e);
      byId.set(e.id, e);
      added++;
    }
  }
  return { added, updated };
}

function importPrehlad(prehlad) {
  if (!prehlad) return 0;
  const existingEntries = safeParseLS("prehlad_entries") || {};
  const incomingEntries = prehlad.entries || {};
  // manuálny sync: novoimportované dni prepíšu staré (predpoklad - importuješ z toho
  // zariadenia, kde si naposledy upravoval kalendár)
  const mergedEntries = { ...existingEntries, ...incomingEntries };
  localStorage.setItem("prehlad_entries", JSON.stringify(mergedEntries));
  if (prehlad.allowances) {
    localStorage.setItem("prehlad_allowances", JSON.stringify(prehlad.allowances));
  }
  return Object.keys(incomingEntries).length;
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);

      if (Array.isArray(incoming)) {
        // staršia záloha - len dochádzka (check-in/check-out)
        const { added, updated } = importDochadzka(incoming);
        persist();
        toast(`Import: pridané ${added}, aktualizované ${updated}`);
        return;
      }

      if (incoming && typeof incoming === "object" && (incoming.dochadzka || incoming.prehlad)) {
        const { added, updated } = importDochadzka(incoming.dochadzka || []);
        const prehladCount = importPrehlad(incoming.prehlad);
        saveEntries(entries);
        toast(`Import hotový (dochádzka +${added}/${updated}, prehľad ${prehladCount} dní) - appka sa obnoví`);
        setTimeout(() => location.reload(), 1200);
        return;
      }

      throw new Error("neznámy formát súboru");
    } catch (e) {
      toast("Chyba pri importe súboru");
      console.error(e);
    }
  };
  reader.readAsText(file);
}

/* ---------- tabs ---------- */

function switchTab(id) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === id));
  document.querySelectorAll(".tabbtn").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
}

document.querySelectorAll(".tabbtn").forEach((b) => {
  b.addEventListener("click", () => switchTab(b.dataset.tab));
});

/* ---------- wire up ---------- */

document.getElementById("btnCheckIn").addEventListener("click", doCheckIn);
document.getElementById("btnCheckOut").addEventListener("click", doCheckOut);
document.getElementById("btnManualAdd").addEventListener("click", openManualDialog);
document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
document.getElementById("btnExportJson").addEventListener("click", exportJson);
document.getElementById("importFile").addEventListener("change", (ev) => {
  const file = ev.target.files[0];
  if (file) importJson(file);
  ev.target.value = "";
});
document.getElementById("btnWipe").addEventListener("click", () => {
  if (confirm("Naozaj vymazať všetky záznamy? Toto sa nedá vrátiť späť.")) {
    entries = [];
    persist();
    toast("Dáta vymazané");
  }
});

/* ---------- init ---------- */

renderClock();
setInterval(renderClock, 30000);
setInterval(() => { if (getOpenEntry()) renderStatus(); }, 60000);
renderAll();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.error("SW register failed", e));
  });
}
