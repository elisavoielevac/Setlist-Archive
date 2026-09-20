const STORAGE_KEY = "setlist-archive-shows-v1";

const fileInput = document.querySelector("#fileInput");
const dropzone = document.querySelector("#dropzone");
const searchInput = document.querySelector("#search");
const searchResults = document.querySelector("#searchResults");
const showList = document.querySelector("#showList");
const bulkBar = document.querySelector("#bulkBar");
const bulkCount = document.querySelector("#bulkCount");
const bulkTour = document.querySelector("#bulkTour");
const bulkLineup = document.querySelector("#bulkLineup");
const bulkNotes = document.querySelector("#bulkNotes");
const toastEl = document.querySelector("#toast");
const showsPanel = document.querySelector("#showsPanel");
const statsPanel = document.querySelector("#statsPanel");
const showsBtn = document.querySelector("#tabShowsBtn");
const statsBtn = document.querySelector("#tabStatsBtn");
const statsContent = document.querySelector("#statsContent");

let shows = [];
let selectedIds = new Set();
let lastSelectedIndex = null;
let searchDebounce = null;

shows = loadShowsFromStorage();
bindEvents();
renderAll();

function bindEvents() {
  fileInput.addEventListener("change", (event) => {
    handleFiles(event.target.files);
    fileInput.value = "";
  });

  dropzone.addEventListener("click", () => fileInput.click());

  ["dragenter", "dragover"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    handleFiles(event.dataTransfer?.files);
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(renderSearch, 120);
  });

  setupTauriFileDrop();

  searchResults.addEventListener("click", (event) => {
    const hit = event.target.closest("[data-focus-show]");
    if (hit) focusShow(hit.dataset.focusShow);
  });

  showsBtn.addEventListener("click", () => switchTab("shows"));
  statsBtn.addEventListener("click", () => switchTab("stats"));

  document.querySelector("#selectAllBtn").addEventListener("click", selectAllShows);
  document.querySelector("#clearSelectionBtn").addEventListener("click", clearSelection);
  document.querySelector("#applyBulkBtn").addEventListener("click", applyBulkEdit);
  document.querySelector("#deleteSelectedBtn").addEventListener("click", deleteSelectedShows);

  showList.addEventListener("click", onShowListClick);
  showList.addEventListener("change", onShowListChange);
}

function loadShowsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load from localStorage", error);
    return [];
  }
}

function saveShowsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shows));
  } catch (error) {
    console.error("Failed to save to localStorage", error);
    toast("Could not save — browser storage may be full");
  }
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toastEl.classList.remove("is-visible"), 2200);
}

function fmtTime(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(remainder)}` : `${minutes}:${pad(remainder)}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function unescapeRpp(value) {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function parseShowNameMeta(filename) {
  const base = filename.replace(/\.(rpp|csv|txt)$/i, "");
  const match = base.match(/^(\d{4})(\d{2})(\d{2})[_\-\s]+(.+)$/);
  if (match) {
    const [, year, month, day, rest] = match;
    const venue = rest.replace(/[_-]+/g, " ").trim();
    return {
      date: `${year}-${month}-${day}`,
      venue,
      name: venue || base.replace(/[_-]+/g, " ").trim(),
    };
  }
  return { date: "", venue: "", name: base.replace(/[_-]+/g, " ").trim() };
}

function parseRppFull(text) {
  const markers = [];
  const items = [];
  const markerRe = /^MARKER\s+\d+\s+([\d.]+)\s+"((?:\\.|[^"])*)"/;
  const lines = String(text || "").split(/\r?\n/);
  const stack = [];
  let currentItem = null;
  let trackIndex = -1;

  for (const raw of lines) {
    const line = raw.trim();
    const markerMatch = line.match(markerRe);
    if (markerMatch) {
      markers.push({
        time: Number.parseFloat(markerMatch[1]),
        name: unescapeRpp(markerMatch[2]).trim(),
      });
    }

    if (line.startsWith("<")) {
      const tag = line.slice(1).split(/\s+/)[0];
      stack.push(tag);
      if (tag === "TRACK") trackIndex += 1;
      if (tag === "ITEM") currentItem = { position: 0, length: 0, track: trackIndex };
    } else if (line === ">") {
      const tag = stack.pop();
      if (tag === "ITEM" && currentItem) {
        items.push(currentItem);
        currentItem = null;
      }
    } else if (stack.length && stack[stack.length - 1] === "ITEM" && currentItem) {
      const posMatch = line.match(/^POSITION\s+([\d.eE+-]+)/);
      const lenMatch = line.match(/^LENGTH\s+([\d.eE+-]+)/);
      if (posMatch) currentItem.position = Number.parseFloat(posMatch[1]);
      if (lenMatch) currentItem.length = Number.parseFloat(lenMatch[1]);
    }
  }

  markers.sort((a, b) => a.time - b.time);
  items.sort((a, b) => a.position - b.position);
  return { markers, items };
}

function timeStrToSeconds(value) {
  const str = String(value).trim();
  if (/^[\d.]+$/.test(str)) return Number.parseFloat(str);
  const parts = str.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  out.push(current);
  return out.map((value) => value.trim());
}

function parseCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) return [];

  const header = splitCsvLine(lines[0]).map((value) => value.toLowerCase());
  const nameIdx = header.findIndex((value) => value.includes("name"));
  const startIdx = header.findIndex((value) => value.includes("start"));
  if (nameIdx === -1 || startIdx === -1) return [];

  const markers = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length <= Math.max(nameIdx, startIdx)) continue;
    const name = cols[nameIdx].trim();
    if (!name) continue;
    markers.push({ time: timeStrToSeconds(cols[startIdx]), name });
  }

  markers.sort((a, b) => a.time - b.time);
  return markers;
}

function computeSetsFromItems(items, numSets) {
  if (!items || !items.length) return [];
  numSets = numSets || 2;

  const relevant = items.filter((item) => item.track !== 0);
  const pool = relevant.length ? relevant : items;
  const overallStart = Math.min(...pool.map((item) => item.position));
  const overallEnd = Math.max(...pool.map((item) => item.position + item.length));
  const totalSpan = overallEnd - overallStart;
  const tolerance = Math.max(5, totalSpan * 0.02);

  const byTrack = {};
  pool.forEach((item) => {
    const key = item.track ?? -1;
    (byTrack[key] = byTrack[key] || []).push(item);
  });

  let best = null;
  Object.keys(byTrack).forEach((key) => {
    const trackItems = byTrack[key].slice().sort((a, b) => a.position - b.position);
    if (trackItems.length !== numSets) return;

    const start = trackItems[0].position;
    const last = trackItems[trackItems.length - 1];
    const end = last.position + last.length;
    if (Math.abs(start - overallStart) <= tolerance && Math.abs(end - overallEnd) <= tolerance) {
      const coverage = end - start;
      if (!best || coverage > best.coverage) best = { trackItems, coverage };
    }
  });

  if (best) return best.trackItems.map((item) => item.length);
  return [totalSpan];
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;

  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

function fuzzyScore(target, query) {
  if (!query) return null;
  target = String(target).toLowerCase();
  query = String(query).toLowerCase().trim();
  if (!query) return null;
  if (target.includes(query)) return 0;

  const queryLength = query.length;
  if (queryLength < 2) return null;

  const threshold = Math.max(1, Math.floor(queryLength * 0.34));
  let best = Infinity;
  const minWin = Math.max(1, queryLength - threshold);
  const maxWin = Math.min(target.length, queryLength + threshold);

  for (let winLen = minWin; winLen <= maxWin; winLen += 1) {
    for (let start = 0; start + winLen <= target.length; start += 1) {
      const dist = levenshtein(target.substr(start, winLen), query);
      if (dist < best) best = dist;
      if (best === 0) return 0;
    }
  }

  return best <= threshold ? best : null;
}

function addMarkersAsShow(filename, markers, items) {
  items = items || [];
  if (!markers.length && !items.length) {
    toast(`No markers or audio found in ${filename}`);
    return;
  }

  const meta = parseShowNameMeta(filename);
  const show = {
    id: `show_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: meta.name,
    date: meta.date,
    venue: meta.venue,
    tour: "",
    lineup: "",
    notes: "",
    markers,
    items,
    numSets: 2,
    addedAt: Date.now(),
  };

  shows.unshift(show);
  saveShowsToStorage();
  renderAll();
  toast(`Added "${show.name}" — ${markers.length} song${markers.length === 1 ? "" : "s"}`);
}

function handleFiles(fileList) {
  if (!fileList?.length) return;

  [...fileList].forEach((file) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => toast(`Could not read ${file.name}`));
    reader.addEventListener("load", (event) => {
      const text = typeof event.target.result === "string" ? event.target.result : "";
      importFileText(file.name, text);
    });
    reader.readAsText(file);
  });
}

function importFileText(filename, text) {
  if (/\.csv$/i.test(filename)) {
    addMarkersAsShow(filename, parseCsv(text), []);
    return;
  }
  const parsed = parseRppFull(text);
  addMarkersAsShow(filename, parsed.markers, parsed.items);
}

async function setupTauriFileDrop() {
  const tauriWebview = window.__TAURI__?.webview;
  const invoke = window.__TAURI__?.core?.invoke;
  if (!tauriWebview?.getCurrentWebview || !invoke) {
    console.info("[Tauri drop] Native drag-and-drop API is unavailable; using browser file input only.");
    return;
  }

  try {
    const currentWebview = tauriWebview.getCurrentWebview();
    await currentWebview.onDragDropEvent(async (event) => {
      const { type } = event.payload;
      if (type === "over") {
        dropzone.classList.add("is-dragover");
        return;
      }

      dropzone.classList.remove("is-dragover");
      if (type !== "drop") return;

      const paths = event.payload.paths || [];
      console.info("[Tauri drop] Native drop received", paths);
      await Promise.all(paths.map(async (path) => {
        const filename = path.split(/[\\/]/).pop() || path;
        try {
          const text = await invoke("read_text_file", { path });
          console.info(`[Tauri drop] Read ${filename}; importing with the existing parser.`);
          importFileText(filename, text);
          console.info(`[Tauri drop] Imported ${filename}.`);
        } catch (error) {
          console.error(`[Tauri drop] Failed to read ${filename}`, error);
          toast(`Could not read ${filename}`);
        }
      }));
    });
    console.info("[Tauri drop] Native drop listener registered.");
  } catch (error) {
    console.error("[Tauri drop] Failed to register the native drop listener", error);
  }
}

function renderRecordingLength(show) {
  if (!show.items || !show.items.length) return "";
  const numSets = show.numSets || 2;
  const blocks = computeSetsFromItems(show.items, numSets);
  const total = blocks.reduce((sum, value) => sum + value, 0);
  const rows = blocks.map((duration, index) => `
    <div class="row">
      <span>Set ${index + 1}</span>
      <span class="row-time">${fmtTime(duration)}</span>
    </div>
  `).join("");

  return `
    <div class="length-box">
      <div class="length-head">
        <span class="length-label">Recording length</span>
        <label class="length-sets"># of sets
          <input type="number" min="1" max="8" value="${numSets}" data-num-sets />
        </label>
      </div>
      ${rows}
      <div class="row is-total">
        <span>Total</span>
        <span class="row-time">${fmtTime(total)}</span>
      </div>
    </div>
  `;
}

function metaInput(show, field, placeholder, extraClass = "") {
  return `<input type="text" data-field="${field}" placeholder="${placeholder}" value="${escapeHtml(show[field] || "")}" class="${extraClass}">`;
}

function sortedShows() {
  return [...shows].sort((a, b) => {
    if (!a.date && !b.date) return a.addedAt - b.addedAt;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}

function renderShows() {
  if (!shows.length) {
    showList.innerHTML = `<div class="empty">No shows yet — drop a Reaper project or marker CSV above to get started.</div>`;
    return;
  }

  showList.innerHTML = sortedShows().map((show) => `
    <div class="show-card" data-id="${escapeHtml(show.id)}">
      <div class="show-card-header">
        <div class="show-card-main">
          <input type="checkbox" data-action="select" ${selectedIds.has(show.id) ? "checked" : ""} />
          <div class="min-w-0">
            <div class="show-name">${escapeHtml(show.name)}</div>
            <div class="show-meta">${escapeHtml(show.date || "no date set")}${show.venue ? ` · ${escapeHtml(show.venue)}` : ""}${show.tour ? ` · ${escapeHtml(show.tour)}` : ""}</div>
          </div>
        </div>
        <div class="show-card-aside">
          <span>${show.markers.length} song${show.markers.length === 1 ? "" : "s"}</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </div>
      </div>
      <div class="show-body">
        <div class="meta-grid">
          ${metaInput(show, "date", "Date (e.g. 2026-03-14)")}
          ${metaInput(show, "venue", "Venue / city")}
          ${metaInput(show, "name", "Show name")}
          ${metaInput(show, "tour", "Tour name")}
        </div>
        ${metaInput(show, "lineup", "Band lineup (comma separated)", "full")}
        <textarea data-field="notes" placeholder="Notes about this show…" rows="2">${escapeHtml(show.notes || "")}</textarea>
        ${renderRecordingLength(show)}
        ${show.markers.map((marker) => `
          <div class="row">
            <span>${escapeHtml(marker.name)}</span>
            <span class="row-time">${fmtTime(marker.time)}</span>
          </div>
        `).join("")}
        <div class="card-actions">
          <button type="button" class="danger-btn" data-action="delete">Delete show</button>
        </div>
      </div>
    </div>
  `).join("");
}

function onShowListClick(event) {
  const card = event.target.closest(".show-card");
  if (!card) return;
  const id = card.dataset.id;

  if (event.target.closest("[data-action='delete']")) {
    removeShow(id);
    return;
  }

  if (event.target.closest("[data-action='select']")) {
    handleCheckboxClick(event, id);
    return;
  }

  if (event.target.closest(".show-card-header")) {
    handleRowClick(event, id);
  }
}

function onShowListChange(event) {
  const card = event.target.closest(".show-card");
  if (!card) return;
  const id = card.dataset.id;

  if (event.target.matches("[data-action='select']")) {
    toggleSelect(id, event.target.checked);
    return;
  }

  if (event.target.matches("[data-num-sets]")) {
    updateNumSets(id, event.target.value);
    return;
  }

  if (event.target.matches("[data-field]")) {
    updateShowField(id, event.target.dataset.field, event.target.value);
  }
}

function toggleShow(id) {
  document.querySelector(`.show-card[data-id="${CSS.escape(id)}"]`)?.classList.toggle("open");
}

function reopenShow(id) {
  document.querySelector(`.show-card[data-id="${CSS.escape(id)}"]`)?.classList.add("open");
}

function focusShow(id) {
  switchTab("shows");
  reopenShow(id);
  document.querySelector(`.show-card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function updateShowField(id, field, value) {
  const show = shows.find((item) => item.id === id);
  if (!show) return;
  show[field] = value;
  saveShowsToStorage();
  renderAll();
  reopenShow(id);
}

function updateNumSets(id, value) {
  const show = shows.find((item) => item.id === id);
  if (!show) return;
  const parsed = Number.parseInt(value, 10);
  show.numSets = Number.isNaN(parsed) || parsed < 1 ? 2 : parsed;
  saveShowsToStorage();
  renderAll();
  reopenShow(id);
}

function removeShow(id) {
  shows = shows.filter((item) => item.id !== id);
  selectedIds.delete(id);
  saveShowsToStorage();
  renderAll();
  toast("Show deleted");
}

function deleteSelectedShows() {
  const selectedShows = shows.filter((show) => selectedIds.has(show.id));
  const count = selectedShows.length;
  if (!count) return;

  const label = `${count} show${count === 1 ? "" : "s"}`;
  if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

  const selectedShowIds = new Set(selectedShows.map((show) => show.id));
  shows = shows.filter((show) => !selectedShowIds.has(show.id));
  lastSelectedIndex = null;
  selectedIds.clear();
  saveShowsToStorage();
  renderAll();
  toast(`Deleted ${label}`);
}

function getSortedIds() {
  return sortedShows().map((show) => show.id);
}

function toggleSelect(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  lastSelectedIndex = getSortedIds().indexOf(id);
  renderBulkBar();
}

function handleCheckboxClick(event, id) {
  event.stopPropagation();
  if (event.shiftKey && lastSelectedIndex !== null) {
    event.preventDefault();
    const ids = getSortedIds();
    const idx = ids.indexOf(id);
    const [start, end] = lastSelectedIndex < idx ? [lastSelectedIndex, idx] : [idx, lastSelectedIndex];
    for (let i = start; i <= end; i += 1) selectedIds.add(ids[i]);
    renderShows();
    renderBulkBar();
  }
}

function handleRowClick(event, id) {
  const ids = getSortedIds();
  const idx = ids.indexOf(id);

  if (event.shiftKey && lastSelectedIndex !== null) {
    const [start, end] = lastSelectedIndex < idx ? [lastSelectedIndex, idx] : [idx, lastSelectedIndex];
    for (let i = start; i <= end; i += 1) selectedIds.add(ids[i]);
    renderShows();
    renderBulkBar();
    return;
  }

  if (event.metaKey || event.ctrlKey) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    lastSelectedIndex = idx;
    renderShows();
    renderBulkBar();
    return;
  }

  toggleShow(id);
}

function selectAllShows() {
  const ids = getSortedIds();
  ids.forEach((id) => selectedIds.add(id));
  lastSelectedIndex = ids.length - 1;
  renderShows();
  renderBulkBar();
}

function clearSelection() {
  lastSelectedIndex = null;
  selectedIds.clear();
  renderShows();
  renderBulkBar();
}

function renderBulkBar() {
  const count = selectedIds.size;
  if (count === 0) {
    bulkBar.classList.add("hidden");
    return;
  }
  bulkBar.classList.remove("hidden");
  bulkCount.textContent = `${count} show${count === 1 ? "" : "s"} selected`;
}

function applyBulkEdit() {
  const tour = bulkTour.value.trim();
  const lineup = bulkLineup.value.trim();
  const notes = bulkNotes.value.trim();
  if (!tour && !lineup && !notes) {
    toast("Enter at least one field to apply");
    return;
  }

  let count = 0;
  shows.forEach((show) => {
    if (!selectedIds.has(show.id)) return;
    if (tour) show.tour = tour;
    if (lineup) show.lineup = lineup;
    if (notes) show.notes = notes;
    count += 1;
  });

  saveShowsToStorage();
  bulkTour.value = "";
  bulkLineup.value = "";
  bulkNotes.value = "";
  renderAll();
  toast(`Updated ${count} show${count === 1 ? "" : "s"}`);
}

function renderSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    searchResults.innerHTML = "";
    return;
  }

  const songHits = [];
  shows.forEach((show) => {
    show.markers.forEach((marker) => {
      const score = fuzzyScore(marker.name, query);
      if (score !== null) songHits.push({ show, marker, score });
    });
  });
  songHits.sort((a, b) => a.score - b.score);

  const showHits = [];
  shows.forEach((show) => {
    const fields = [show.name, show.venue, show.tour, show.lineup, show.notes].filter(Boolean);
    let bestScore = null;
    fields.forEach((field) => {
      const score = fuzzyScore(field, query);
      if (score !== null && (bestScore === null || score < bestScore)) bestScore = score;
    });
    if (bestScore !== null) showHits.push({ show, score: bestScore });
  });
  showHits.sort((a, b) => a.score - b.score);

  if (!songHits.length && !showHits.length) {
    searchResults.innerHTML = `<div class="empty">No matches for "${escapeHtml(query)}".</div>`;
    return;
  }

  let html = "";
  if (songHits.length) {
    html += `<div class="search-count">${songHits.length} play${songHits.length === 1 ? "" : "s"} found</div>`;
    html += songHits.map(({ show, marker }) => `
      <div class="hit" data-focus-show="${escapeHtml(show.id)}">
        <div class="min-w-0">
          <div class="hit-title">${escapeHtml(marker.name)}</div>
          <div class="hit-sub">${escapeHtml(show.name)}${show.date ? ` · ${escapeHtml(show.date)}` : ""}${show.venue ? ` · ${escapeHtml(show.venue)}` : ""}</div>
        </div>
        <div class="hit-time">${fmtTime(marker.time)}</div>
      </div>
    `).join("");
  }

  if (showHits.length) {
    html += `<div class="search-count${songHits.length ? " is-later" : ""}">${showHits.length} show${showHits.length === 1 ? "" : "s"} matched</div>`;
    html += showHits.map(({ show }) => `
      <div class="hit" data-focus-show="${escapeHtml(show.id)}">
        <div class="min-w-0">
          <div class="hit-title">${escapeHtml(show.name)}</div>
          <div class="hit-sub">${[show.date, show.venue, show.tour, show.lineup].filter(Boolean).map((value) => escapeHtml(value)).join(" · ")}</div>
        </div>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </div>
    `).join("");
  }

  searchResults.innerHTML = html;
}

function computeStats() {
  const songCounts = {};
  let totalMarkers = 0;

  shows.forEach((show) => {
    show.markers.forEach((marker) => {
      const key = marker.name.trim().toLowerCase();
      if (!key) return;
      songCounts[key] = songCounts[key] || { name: marker.name, count: 0 };
      songCounts[key].count += 1;
      totalMarkers += 1;
    });
  });

  const topSongs = Object.values(songCounts).sort((a, b) => b.count - a.count).slice(0, 8);
  let longest = null;
  let shortest = null;
  let totalShowLength = 0;
  let showsWithLength = 0;
  const allSetLengths = [];

  shows.forEach((show) => {
    if (!show.items?.length) return;
    const blocks = computeSetsFromItems(show.items, show.numSets || 2);
    const total = blocks.reduce((sum, value) => sum + value, 0);
    totalShowLength += total;
    showsWithLength += 1;
    allSetLengths.push(...blocks);
    if (!longest || total > longest.total) longest = { show, total };
    if (!shortest || total < shortest.total) shortest = { show, total };
  });

  return {
    totalShows: shows.length,
    totalMarkers,
    uniqueSongs: Object.keys(songCounts).length,
    topSongs,
    longest,
    shortest,
    avgShowLength: showsWithLength ? totalShowLength / showsWithLength : 0,
    avgSetLength: allSetLengths.length ? allSetLengths.reduce((sum, value) => sum + value, 0) / allSetLengths.length : 0,
  };
}

function statChip(value, label) {
  return `
    <div class="stat-chip">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

function renderStats() {
  if (!shows.length) {
    statsContent.innerHTML = `<div class="empty">Add some shows to see stats.</div>`;
    return;
  }

  const stats = computeStats();
  const topSongsHtml = stats.topSongs.map((song, index) => `
    <div class="row">
      <span class="truncate">${index + 1}. ${escapeHtml(song.name)}</span>
      <span class="row-time">${song.count}×</span>
    </div>
  `).join("");

  statsContent.innerHTML = `
    <div class="stat-grid">
      ${statChip(stats.totalShows, "shows")}
      ${statChip(stats.totalMarkers, "songs played")}
      ${statChip(stats.uniqueSongs, "unique songs")}
      ${statChip(fmtTime(stats.avgShowLength), "avg show length")}
    </div>
    <div class="stats-columns">
      <div>
        <div class="stats-heading">Most played</div>
        ${topSongsHtml || `<div class="empty">No songs yet.</div>`}
      </div>
      <div>
        <div class="stats-heading">Show lengths</div>
        <div class="stats-line"><span>Longest</span><span>${stats.longest ? `${fmtTime(stats.longest.total)} — ${escapeHtml(stats.longest.show.name)}` : "—"}</span></div>
        <div class="stats-line"><span>Shortest</span><span>${stats.shortest ? `${fmtTime(stats.shortest.total)} — ${escapeHtml(stats.shortest.show.name)}` : "—"}</span></div>
        <div class="stats-line"><span>Avg set length</span><span>${fmtTime(stats.avgSetLength)}</span></div>
      </div>
    </div>
  `;
}

function renderAll() {
  renderShows();
  renderStats();
  renderSearch();
  renderBulkBar();
}

function switchTab(tab) {
  const statsActive = tab === "stats";
  showsPanel.classList.toggle("hidden", statsActive);
  statsPanel.classList.toggle("hidden", !statsActive);
  showsBtn.classList.toggle("is-active", !statsActive);
  statsBtn.classList.toggle("is-active", statsActive);
}
