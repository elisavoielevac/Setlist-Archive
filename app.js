const trackerPersistence = window.trackerPersistence;

const fileInput = document.querySelector("#fileInput");
const dropzone = document.querySelector("#dropzone");
const dropzoneText = document.querySelector("#dzText");
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
const deleteConfirmDialog = document.querySelector("#deleteConfirmDialog");
const deleteConfirmMessage = document.querySelector("#deleteConfirmMessage");
const cancelDeleteBtn = document.querySelector("#cancelDeleteBtn");
const confirmDeleteBtn = document.querySelector("#confirmDeleteBtn");
const trackerNameDialog = document.querySelector("#trackerNameDialog");
const trackerNameDialogTitle = document.querySelector("#trackerNameDialogTitle");
const trackerNameDialogMessage = document.querySelector("#trackerNameDialogMessage");
const trackerNameDialogLabel = document.querySelector(".tracker-name-dialog-label");
const trackerNameInput = document.querySelector("#trackerNameInput");
const trackerNameDialogError = document.querySelector("#trackerNameDialogError");
const cancelTrackerNameBtn = document.querySelector("#cancelTrackerNameBtn");
const confirmTrackerNameBtn = document.querySelector("#confirmTrackerNameBtn");
const trackerNameEl = document.querySelector("#trackerName");
const trackerStatusEl = document.querySelector("#trackerStatus");
const newTrackerBtn = document.querySelector("#newTrackerBtn");
const manageArchivesBtn = document.querySelector("#manageArchivesBtn");
const manageArchivesDialog = document.querySelector("#manageArchivesDialog");
const manageArchivesList = document.querySelector("#manageArchivesList");
const cancelManageArchivesBtn = document.querySelector("#cancelManageArchivesBtn");
const openManagedArchiveBtn = document.querySelector("#openManagedArchiveBtn");
const importManagedArchiveBtn = document.querySelector("#importManagedArchiveBtn");
const renameManagedArchiveBtn = document.querySelector("#renameManagedArchiveBtn");
const duplicateManagedArchiveBtn = document.querySelector("#duplicateManagedArchiveBtn");
const exportManagedArchiveBtn = document.querySelector("#exportManagedArchiveBtn");
const deleteManagedArchiveBtn = document.querySelector("#deleteManagedArchiveBtn");
const revealManagedArchiveBtn = document.querySelector("#revealManagedArchiveBtn");

let shows = [];
let selectedIds = new Set();
let lastSelectedIndex = null;
let searchDebounce = null;
let pendingDeleteConfirmation = null;
let pendingTrackerNameDialog = null;
let activeTracker = null;
let trackerSaveStatus = "saved";
let trackerSaveRevision = 0;
let selectedManagedArchiveName = null;
let dialogReturnFocus = null;
let importHighlightTimer = null;
let highlightedImportedShow = null;

const SET_BOUNDARY_SYNC_TOLERANCE_SECONDS = 0.75;

bindEvents();
renderAll();
void restoreLastTracker();

function bindEvents() {
  fileInput.addEventListener("change", (event) => {
    if (!requireActiveTracker()) {
      fileInput.value = "";
      return;
    }
    handleFiles(event.target.files);
    fileInput.value = "";
  });

  dropzone.addEventListener("click", () => {
    if (requireActiveTracker()) fileInput.click();
  });

  ["dragenter", "dragover"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      if (activeTracker) dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    if (!requireActiveTracker()) return;
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
  newTrackerBtn.addEventListener("click", createTracker);
  manageArchivesBtn.addEventListener("click", showManageArchives);
  cancelManageArchivesBtn.addEventListener("click", closeManageArchives);
  openManagedArchiveBtn.addEventListener("click", openSelectedManagedArchive);
  importManagedArchiveBtn.addEventListener("click", importArchive);
  renameManagedArchiveBtn.addEventListener("click", renameSelectedManagedArchive);
  duplicateManagedArchiveBtn.addEventListener("click", duplicateSelectedManagedArchive);
  exportManagedArchiveBtn.addEventListener("click", exportSelectedManagedArchive);
  deleteManagedArchiveBtn.addEventListener("click", deleteSelectedManagedArchive);
  revealManagedArchiveBtn.addEventListener("click", revealSelectedManagedArchive);
  cancelDeleteBtn.addEventListener("click", () => resolveDeleteConfirmation(false));
  confirmDeleteBtn.addEventListener("click", () => resolveDeleteConfirmation(true));
  cancelTrackerNameBtn.addEventListener("click", () => resolveTrackerNameDialog(null));
  confirmTrackerNameBtn.addEventListener("click", submitTrackerNameDialog);
  trackerNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitTrackerNameDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (pendingDeleteConfirmation) {
        resolveDeleteConfirmation(false);
        return;
      }
      if (pendingTrackerNameDialog) {
        resolveTrackerNameDialog(null);
        return;
      }
      closeManageArchives();
    }
  });

  showList.addEventListener("click", onShowListClick);
  showList.addEventListener("change", onShowListChange);
}

function saveShows() {
  if (!activeTracker) return;
  queueActiveTrackerSave();
}

function requireActiveTracker() {
  if (activeTracker) return true;
  toast("Create or select an archive before adding shows");
  return false;
}

function queueActiveTrackerSave() {
  const tracker = activeTracker;
  const saveRevision = ++trackerSaveRevision;
  trackerSaveStatus = "saving";
  renderTrackerState();

  trackerPersistence.queueManagedTrackerFileWrite(tracker.name, shows, tracker.createdAt).then(
    () => {
      if (activeTracker === tracker && saveRevision === trackerSaveRevision) {
        trackerSaveStatus = "saved";
        renderTrackerState();
      }
    },
    (error) => {
      console.error("Failed to autosave tracker", error);
      if (activeTracker === tracker && saveRevision === trackerSaveRevision) {
        trackerSaveStatus = "failed";
        renderTrackerState();
      }
    },
  );
}

function trackerDisplayName(name) {
  return name.replace(/\.setlistarchive$/i, "");
}

function ensureTrackerExtension(name) {
  return /\.setlistarchive$/i.test(name) ? name : `${name}.setlistarchive`;
}

function clearTrackerSelectionState() {
  selectedIds.clear();
  lastSelectedIndex = null;
  bulkTour.value = "";
  bulkLineup.value = "";
  bulkNotes.value = "";
}

function renderTrackerState() {
  if (!activeTracker) {
    trackerNameEl.textContent = "No archive open";
    trackerStatusEl.textContent = "Create or select an archive to begin";
    fileInput.disabled = true;
    dropzone.classList.add("is-disabled");
    dropzone.setAttribute("aria-disabled", "true");
    dropzoneText.innerHTML = "<strong>Create or select an archive first</strong><br />then import .rpp or .csv files";
    return;
  }

  trackerNameEl.textContent = trackerDisplayName(activeTracker.name);
  trackerStatusEl.textContent = {
    saving: "Saving…",
    saved: "Saved",
    failed: "Save failed",
  }[trackerSaveStatus];
  fileInput.disabled = false;
  dropzone.classList.remove("is-disabled");
  dropzone.setAttribute("aria-disabled", "false");
  dropzoneText.innerHTML = "<strong>Drop .rpp or .csv files here</strong><br />or click to choose files";
}

async function activateTracker(name, tracker) {
  activeTracker = { name, createdAt: tracker.createdAt };
  trackerSaveStatus = "saved";
  trackerSaveRevision += 1;
  trackerPersistence.clearTrackerWriteError();
  shows = tracker.shows;
  clearTrackerSelectionState();
  renderAll();
  try {
    await trackerPersistence.writeLastTrackerName(name);
  } catch (error) {
    console.error("Failed to remember the active tracker", error);
  }
}

async function waitForActiveTrackerSaves({ allowFailure = false } = {}) {
  if (!activeTracker) return true;
  try {
    await trackerPersistence.waitForTrackerFileWrites();
    return true;
  } catch (error) {
    console.error("Failed to finish saving tracker", error);
    if (allowFailure) return false;
    trackerSaveStatus = "failed";
    renderTrackerState();
    toast("Save failed. The current archive was not changed.");
    return false;
  }
}

async function restoreLastTracker() {
  if (!window.__TAURI__?.core?.invoke) return;
  try {
    const name = await trackerPersistence.readLastTrackerName();
    if (!name) return;
    const tracker = await trackerPersistence.readManagedTrackerFile(name);
    await activateTracker(name, tracker);
  } catch (error) {
    console.error("Failed to reopen the last tracker", error);
    try {
      await trackerPersistence.clearLastTrackerName();
    } catch (clearError) {
      console.error("Failed to clear the invalid tracker preference", clearError);
    }
    toast("Could not reopen the last archive. Create or open an archive.");
  }
}

function requestManagedTrackerName({ title, message = "", defaultName = "", submitLabel }) {
  return new Promise((resolve) => {
    pendingTrackerNameDialog = resolve;
    dialogReturnFocus = document.activeElement;
    trackerNameDialogTitle.textContent = title;
    trackerNameDialogMessage.textContent = message;
    trackerNameDialogMessage.classList.toggle("hidden", !message);
    trackerNameDialogLabel.classList.remove("hidden");
    trackerNameInput.classList.remove("hidden");
    trackerNameInput.value = defaultName;
    trackerNameDialogError.textContent = "";
    trackerNameDialogError.classList.add("hidden");
    confirmTrackerNameBtn.textContent = submitLabel;
    confirmTrackerNameBtn.classList.remove("hidden");
    trackerNameDialog.classList.remove("hidden");
    requestAnimationFrame(() => {
      trackerNameInput.focus();
      trackerNameInput.select();
    });
  });
}

function submitTrackerNameDialog() {
  const name = trackerNameInput.value.trim();
  const validationError = validateManagedTrackerName(name);
  if (validationError) {
    trackerNameDialogError.textContent = validationError;
    trackerNameDialogError.classList.remove("hidden");
    trackerNameInput.focus();
    return;
  }
  resolveTrackerNameDialog(ensureTrackerExtension(name));
}

function resolveTrackerNameDialog(name) {
  const resolve = pendingTrackerNameDialog;
  if (!resolve) return;

  pendingTrackerNameDialog = null;
  trackerNameDialog.classList.add("hidden");
  resolve(name);
  restoreDialogFocus();
}

function restoreDialogFocus() {
  const element = dialogReturnFocus;
  dialogReturnFocus = null;
  if (element instanceof HTMLElement && document.contains(element) && !element.matches(":disabled")) {
    element.focus();
  }
}

function validateManagedTrackerName(name) {
  if (!name) return "Enter an archive name.";
  if (name === "." || name === "..") return 'Archive name cannot be "." or "..".';
  if (name.includes("/") || name.includes("\\")) return "Archive name cannot contain / or \\.";

  const stem = name.replace(/\.setlistarchive$/i, "").trim();
  if (!stem) return "Enter an archive name before the .setlistarchive extension.";
  return "";
}

async function managedTrackerNameExists(name) {
  const trackerNames = await trackerPersistence.listManagedTrackerFiles();
  return trackerNames.some((existingName) => existingName.toLowerCase() === name.toLowerCase());
}

function nativeDialog() {
  const dialog = window.__TAURI__?.dialog;
  if (!dialog?.open || !dialog?.save) throw new Error("Archive import and export require the Tauri desktop app");
  return dialog;
}

function archiveNameFromPath(path) {
  return String(path).split(/[\\/]/).pop() || "";
}

async function requestImportArchiveName(defaultName) {
  let name = defaultName;
  while (await managedTrackerNameExists(name)) {
    name = await requestManagedTrackerName({
      title: "Import Archive",
      message: `An archive named ${trackerDisplayName(name)} already exists. Choose a different name.`,
      defaultName: trackerDisplayName(name),
      submitLabel: "Import",
    });
    if (!name) return null;
  }
  return name;
}

async function importArchive() {
  try {
    const sourcePath = await nativeDialog().open({
      title: "Import Archive",
      multiple: false,
      directory: false,
      filters: [{ name: "Setlist Archive", extensions: ["setlistarchive"] }],
    });
    if (!sourcePath || Array.isArray(sourcePath)) return;

    const defaultName = archiveNameFromPath(sourcePath);
    if (!/\.setlistarchive$/i.test(defaultName)) {
      toast("Choose a .setlistarchive file");
      return;
    }

    const importedTracker = await trackerPersistence.readTrackerFile(sourcePath);
    const name = await requestImportArchiveName(ensureTrackerExtension(defaultName));
    if (!name) return;

    await trackerPersistence.writeManagedTrackerFile(
      name,
      importedTracker.shows,
      importedTracker.createdAt,
      importedTracker.updatedAt,
    );
    selectedManagedArchiveName = name;
    await refreshManageArchives();
    toast(`Imported ${trackerDisplayName(name)}`);
  } catch (error) {
    console.error("Failed to import archive", error);
    toast("Could not import archive. The current archive was not changed.");
  }
}

async function exportSelectedManagedArchive() {
  const name = selectedManagedArchiveName;
  if (!name) return;

  try {
    const destinationPath = await nativeDialog().save({
      title: "Export Archive",
      defaultPath: name,
      filters: [{ name: "Setlist Archive", extensions: ["setlistarchive"] }],
    });
    if (!destinationPath) return;

    let tracker;
    if (name === activeTracker?.name) {
      if (!(await waitForActiveTrackerSaves())) return;
      tracker = {
        shows,
        createdAt: activeTracker.createdAt,
        updatedAt: Date.now(),
      };
    } else {
      tracker = await trackerPersistence.readManagedTrackerFile(name);
    }

    const exportPath = ensureTrackerExtension(destinationPath);
    await trackerPersistence.writeTrackerFile(
      exportPath,
      tracker.shows,
      tracker.createdAt,
      tracker.updatedAt,
    );
    toast(`Exported ${trackerDisplayName(name)}`);
  } catch (error) {
    console.error("Failed to export archive", error);
    toast("Could not export archive. The current archive was not changed.");
  }
}

async function refreshManageArchives() {
  const archiveNames = await trackerPersistence.listManagedTrackerFiles();
  renderManageArchives(archiveNames);
}

async function createTracker() {
  const name = await requestManagedTrackerName({
    title: "New Archive",
    defaultName: "Untitled",
    submitLabel: "Create",
  });
  if (!name || !(await waitForActiveTrackerSaves())) return;

  const now = Date.now();
  try {
    if (await managedTrackerNameExists(name)) {
      toast("An archive with that name already exists");
      return;
    }
    const tracker = await trackerPersistence.writeManagedTrackerFile(name, [], now, now);
    await activateTracker(name, tracker);
    toast(`Created ${trackerDisplayName(name)}`);
  } catch (error) {
    console.error("Failed to create tracker", error);
    toast("Could not create archive. The current archive was not changed.");
  }
}

async function switchToManagedArchive(name) {
  if (!(await waitForActiveTrackerSaves())) return false;
  if (activeTracker?.name === name) return true;
  const tracker = await trackerPersistence.readManagedTrackerFile(name);
  await activateTracker(name, tracker);
  return true;
}

async function showManageArchives() {
  try {
    const archiveNames = await trackerPersistence.listManagedTrackerFiles();
    selectedManagedArchiveName = activeTracker && archiveNames.includes(activeTracker.name) ? activeTracker.name : null;
    renderManageArchives(archiveNames);
    manageArchivesDialog.classList.remove("hidden");
    requestAnimationFrame(() => {
      const selectedRow = manageArchivesList.querySelector(".manage-archive-row.is-selected");
      const firstRow = manageArchivesList.querySelector(".manage-archive-row");
      (selectedRow || firstRow || cancelManageArchivesBtn).focus();
    });
  } catch (error) {
    console.error("Failed to list managed archives", error);
    toast("Could not load archives");
  }
}

function renderManageArchives(archiveNames) {
  manageArchivesList.innerHTML = "";

  if (!archiveNames.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "manage-archives-empty";
    emptyState.textContent = "No archives available";
    manageArchivesList.append(emptyState);
  } else {
    archiveNames.forEach((name) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "manage-archive-row";
      row.setAttribute("aria-pressed", String(name === selectedManagedArchiveName));

      if (name === selectedManagedArchiveName) row.classList.add("is-selected");

      const archiveName = document.createElement("span");
      archiveName.className = "manage-archive-name";
      archiveName.textContent = trackerDisplayName(name);
      row.append(archiveName);

      if (activeTracker && name === activeTracker.name) {
        const status = document.createElement("span");
        status.className = "manage-archive-status";
        status.textContent = "Active";
        row.append(status);
      }

      row.addEventListener("click", () => {
        selectedManagedArchiveName = name;
        renderManageArchives(archiveNames);
      });
      manageArchivesList.append(row);
    });
  }

  const hasSelection = Boolean(selectedManagedArchiveName);
  openManagedArchiveBtn.disabled = !hasSelection;
  renameManagedArchiveBtn.disabled = !hasSelection;
  duplicateManagedArchiveBtn.disabled = !hasSelection;
  exportManagedArchiveBtn.disabled = !hasSelection;
  deleteManagedArchiveBtn.disabled = !hasSelection;
  revealManagedArchiveBtn.disabled = !hasSelection;
}

function closeManageArchives() {
  if (manageArchivesDialog.classList.contains("hidden")) return;
  selectedManagedArchiveName = null;
  manageArchivesDialog.classList.add("hidden");
}

async function openSelectedManagedArchive() {
  const name = selectedManagedArchiveName;
  if (!name) return;

  try {
    if (!(await switchToManagedArchive(name))) return;
    closeManageArchives();
    toast(`Opened ${trackerDisplayName(name)}`);
  } catch (error) {
    console.error("Failed to open managed archive", error);
    toast("Could not open archive. The current archive was not changed.");
  }
}

async function renameSelectedManagedArchive() {
  const oldName = selectedManagedArchiveName;
  if (!oldName) return;

  const newName = await requestManagedTrackerName({
    title: "Rename Archive",
    defaultName: trackerDisplayName(oldName),
    submitLabel: "Rename",
  });
  if (!newName || newName.toLowerCase() === oldName.toLowerCase()) return;

  try {
    if (oldName === activeTracker?.name && !(await waitForActiveTrackerSaves())) return;
    if (await managedTrackerNameExists(newName)) {
      toast("An archive with that name already exists");
      return;
    }

    const renamedName = await trackerPersistence.renameManagedTrackerFile(oldName, newName);
    let preferenceError = false;
    if (activeTracker?.name === oldName) {
      activeTracker.name = renamedName;
      renderAll();
      try {
        await trackerPersistence.writeLastTrackerName(renamedName);
      } catch (error) {
        console.error("Failed to remember the renamed active archive", error);
        preferenceError = true;
      }
    }
    selectedManagedArchiveName = renamedName;
    const archiveNames = await trackerPersistence.listManagedTrackerFiles();
    renderManageArchives(archiveNames);
    toast(preferenceError
      ? "Archive renamed, but the active preference could not be updated"
      : `Renamed to ${trackerDisplayName(renamedName)}`);
  } catch (error) {
    console.error("Failed to rename managed archive", error);
    toast("Could not rename archive");
  }
}

async function duplicateSelectedManagedArchive() {
  const sourceName = selectedManagedArchiveName;
  if (!sourceName) return;

  const name = await requestManagedTrackerName({
    title: "Duplicate Archive",
    defaultName: `${trackerDisplayName(sourceName)} copy`,
    submitLabel: "Duplicate",
  });
  if (!name || name.toLowerCase() === sourceName.toLowerCase()) {
    if (name) toast("Choose a new archive name to duplicate");
    return;
  }

  try {
    if (sourceName === activeTracker?.name && !(await waitForActiveTrackerSaves())) return;
    if (await managedTrackerNameExists(name)) {
      toast("An archive with that name already exists");
      return;
    }

    const source = sourceName === activeTracker?.name
      ? { shows, createdAt: activeTracker.createdAt }
      : await trackerPersistence.readManagedTrackerFile(sourceName);
    const now = Date.now();
    const tracker = await trackerPersistence.writeManagedTrackerFile(name, source.shows, source.createdAt, now);
    await activateTracker(name, tracker);
    selectedManagedArchiveName = name;
    const archiveNames = await trackerPersistence.listManagedTrackerFiles();
    renderManageArchives(archiveNames);
    toast(`Duplicated ${trackerDisplayName(name)}`);
  } catch (error) {
    console.error("Failed to duplicate managed archive", error);
    toast("Could not duplicate archive. The current archive was not changed.");
  }
}

async function deleteSelectedManagedArchive() {
  const name = selectedManagedArchiveName;
  if (!name) return;
  if (!await confirmSelectedDeletion(`Delete ${trackerDisplayName(name)}? This cannot be undone.`)) return;

  try {
    if (name === activeTracker?.name && !(await waitForActiveTrackerSaves())) return;
    await trackerPersistence.deleteManagedTrackerFile(name);

    if (name === activeTracker?.name) {
      activeTracker = null;
      shows = [];
      trackerSaveRevision += 1;
      trackerSaveStatus = "saved";
      clearTrackerSelectionState();
      renderAll();
      try {
        await trackerPersistence.clearLastTrackerName();
      } catch (error) {
        console.error("Failed to clear the deleted archive preference", error);
      }
    }

    selectedManagedArchiveName = null;
    const archiveNames = await trackerPersistence.listManagedTrackerFiles();
    renderManageArchives(archiveNames);
    toast(`Deleted ${trackerDisplayName(name)}`);
  } catch (error) {
    console.error("Failed to delete managed archive", error);
    toast("Could not delete archive");
  }
}

async function revealSelectedManagedArchive() {
  const name = selectedManagedArchiveName;
  if (!name) return;

  try {
    await trackerPersistence.revealManagedTrackerFile(name);
  } catch (error) {
    console.error("Failed to reveal managed archive", error);
    toast("Could not reveal archive in Finder");
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

function clusterRecordingTimestamps(timestamps) {
  const clusters = [];
  timestamps.slice().sort((left, right) => left - right).forEach((timestamp) => {
    const cluster = clusters.find((candidate) => (
      Math.abs(timestamp - candidate.referenceTime) <= SET_BOUNDARY_SYNC_TOLERANCE_SECONDS
    ));

    if (cluster) {
      cluster.times.push(timestamp);
      return;
    }

    clusters.push({
      referenceTime: timestamp,
      times: [timestamp],
    });
  });

  return clusters.map((cluster) => ({
    time: cluster.times.reduce((sum, timestamp) => sum + timestamp, 0) / cluster.times.length,
  }));
}

function recordingTimestampSupport(intervals, time, field) {
  const tracks = new Set();
  intervals.forEach((interval) => {
    if (Math.abs(interval[field] - time) <= SET_BOUNDARY_SYNC_TOLERANCE_SECONDS) {
      tracks.add(interval.track);
    }
  });
  return tracks.size;
}

function chooseRecordingEnvelopeCluster(clusters, intervals, field, requiredSupport, direction) {
  const supportedClusters = clusters.filter((cluster) => (
    recordingTimestampSupport(intervals, cluster.time, field) >= requiredSupport
  ));
  if (supportedClusters.length) {
    return direction === "latest" ? supportedClusters[supportedClusters.length - 1] : supportedClusters[0];
  }

  return clusters
    .slice()
    .sort((left, right) => {
      const supportDifference = recordingTimestampSupport(intervals, right.time, field)
        - recordingTimestampSupport(intervals, left.time, field);
      if (supportDifference) return supportDifference;
      return direction === "latest" ? right.time - left.time : left.time - right.time;
    })[0];
}

function detectRecordingPasses(items) {
  if (!items || !items.length) return [];

  const intervals = items
    .map((item) => ({
      start: Number(item.position),
      end: Number(item.position) + Number(item.length),
      track: item.track ?? null,
    }))
    .filter((item) => (
      Number.isFinite(item.start)
      && Number.isFinite(item.end)
      && item.end > item.start
    ))
    .sort((left, right) => left.start - right.start || left.end - right.end);

  if (!intervals.length) return [];

  const participatingTrackCount = new Set(intervals.map((interval) => interval.track)).size;
  const requiredSupport = Math.max(3, Math.ceil(participatingTrackCount * 0.5));
  const startCluster = chooseRecordingEnvelopeCluster(
    clusterRecordingTimestamps(intervals.map((interval) => interval.start)),
    intervals,
    "start",
    requiredSupport,
    "earliest",
  );
  const endCluster = chooseRecordingEnvelopeCluster(
    clusterRecordingTimestamps(intervals.map((interval) => interval.end)),
    intervals,
    "end",
    requiredSupport,
    "latest",
  );
  if (!startCluster || !endCluster || endCluster.time <= startCluster.time) return [];

  const recordingStart = startCluster.time;
  const recordingEnd = endCluster.time;
  const boundaries = clusterRecordingTimestamps(intervals.flatMap((interval) => [interval.start, interval.end]))
    .map((cluster) => cluster.time)
    .filter((boundary) => (
      boundary > recordingStart + SET_BOUNDARY_SYNC_TOLERANCE_SECONDS
      && boundary < recordingEnd - SET_BOUNDARY_SYNC_TOLERANCE_SECONDS
    ))
    .filter((boundary) => {
      return recordingTimestampSupport(intervals, boundary, "end") >= requiredSupport
        && recordingTimestampSupport(intervals, boundary, "start") >= requiredSupport;
    })
    .sort((left, right) => left - right);

  const segmentBoundaries = [recordingStart, ...boundaries, recordingEnd];
  return segmentBoundaries.slice(0, -1).map((start, index) => {
    const end = segmentBoundaries[index + 1];
    return {
      start,
      end,
      duration: end - start,
    };
  });
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
  if (!requireActiveTracker()) return null;
  items = items || [];
  if (!markers.length && !items.length) {
    toast(`No markers or audio found in ${filename}`);
    return null;
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
    addedAt: Date.now(),
  };

  shows.unshift(show);
  saveShows();
  renderAll();
  toast(`Added "${show.name}" — ${markers.length} song${markers.length === 1 ? "" : "s"}`);
  return show;
}

async function handleFiles(fileList) {
  if (!requireActiveTracker() || !fileList?.length) return;

  const importedShows = await Promise.all([...fileList].map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => {
      toast(`Could not read ${file.name}`);
      resolve(null);
    });
    reader.addEventListener("load", (event) => {
      const text = typeof event.target.result === "string" ? event.target.result : "";
      resolve(importFileText(file.name, text));
    });
    reader.readAsText(file);
  })));

  finishImportedShowBatch(importedShows);
}

function importFileText(filename, text) {
  if (/\.csv$/i.test(filename)) {
    return addMarkersAsShow(filename, parseCsv(text), []);
  }
  const parsed = parseRppFull(text);
  return addMarkersAsShow(filename, parsed.markers, parsed.items);
}

function finishImportedShowBatch(importedShows) {
  const successfulShows = importedShows.filter(Boolean);
  const lastImportedShow = successfulShows[successfulShows.length - 1];
  if (!lastImportedShow) return;

  renderAll();
  requestAnimationFrame(() => highlightImportedShow(lastImportedShow.id));
}

function highlightImportedShow(showId) {
  if (importHighlightTimer) clearTimeout(importHighlightTimer);
  highlightedImportedShow?.classList.remove("is-import-highlighted");

  const card = document.querySelector(`.show-card[data-id="${CSS.escape(showId)}"]`);
  if (!card) return;

  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("is-import-highlighted");
  highlightedImportedShow = card;
  importHighlightTimer = setTimeout(() => {
    card.classList.remove("is-import-highlighted");
    if (highlightedImportedShow === card) highlightedImportedShow = null;
    importHighlightTimer = null;
  }, 1600);
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
        if (activeTracker) dropzone.classList.add("is-dragover");
        return;
      }

      dropzone.classList.remove("is-dragover");
      if (type !== "drop") return;
      if (!requireActiveTracker()) return;

      const paths = event.payload.paths || [];
      console.info("[Tauri drop] Native drop received", paths);
      const importedShows = await Promise.all(paths.map(async (path) => {
        const filename = path.split(/[\\/]/).pop() || path;
        try {
          const text = await invoke("read_text_file", { path });
          console.info(`[Tauri drop] Read ${filename}; importing with the existing parser.`);
          const importedShow = importFileText(filename, text);
          console.info(`[Tauri drop] Imported ${filename}.`);
          return importedShow;
        } catch (error) {
          console.error(`[Tauri drop] Failed to read ${filename}`, error);
          toast(`Could not read ${filename}`);
          return null;
        }
      }));
      finishImportedShowBatch(importedShows);
    });
    console.info("[Tauri drop] Native drop listener registered.");
  } catch (error) {
    console.error("[Tauri drop] Failed to register the native drop listener", error);
  }
}

function renderRecordingLength(show) {
  if (!show.items || !show.items.length) return "";
  const passes = detectRecordingPasses(show.items);
  if (!passes.length) return "";
  const total = passes.reduce((sum, pass) => sum + pass.duration, 0);
  const rows = passes.map((pass, index) => `
    <div class="row">
      <span>Set ${index + 1}</span>
      <span class="row-time">${fmtTime(pass.duration)}</span>
    </div>
  `).join("");

  return `
    <div class="length-box">
      <div class="length-head">
        <span class="length-label">Recording length</span>
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
    showList.innerHTML = activeTracker
      ? `<div class="empty">No shows yet — drop a Reaper project or marker CSV above to get started.</div>`
      : `<div class="empty">Create or select an archive to get started.</div>`;
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
  saveShows();
  renderAll();
  reopenShow(id);
}

function removeShow(id) {
  shows = shows.filter((item) => item.id !== id);
  selectedIds.delete(id);
  saveShows();
  renderAll();
  toast("Show deleted");
}

async function deleteSelectedShows() {
  const selectedShows = shows.filter((show) => selectedIds.has(show.id));
  const count = selectedShows.length;
  if (!count) return;

  const label = `${count} show${count === 1 ? "" : "s"}`;
  if (!await confirmSelectedDeletion(`Delete ${label}? This cannot be undone.`)) return;

  const selectedShowIds = new Set(selectedShows.map((show) => show.id));
  shows = shows.filter((show) => !selectedShowIds.has(show.id));
  lastSelectedIndex = null;
  selectedIds.clear();
  saveShows();
  renderAll();
  toast(`Deleted ${label}`);
}

function confirmSelectedDeletion(message) {
  if (!window.__TAURI__) return Promise.resolve(window.confirm(message));
  if (pendingDeleteConfirmation) return Promise.resolve(false);

  dialogReturnFocus = document.activeElement;
  deleteConfirmMessage.textContent = message;
  deleteConfirmDialog.classList.remove("hidden");
  confirmDeleteBtn.focus();
  return new Promise((resolve) => {
    pendingDeleteConfirmation = resolve;
  });
}

function resolveDeleteConfirmation(confirmed) {
  if (!pendingDeleteConfirmation) return;
  const resolve = pendingDeleteConfirmation;
  pendingDeleteConfirmation = null;
  deleteConfirmDialog.classList.add("hidden");
  resolve(confirmed);
  restoreDialogFocus();
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

  saveShows();
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
    const passes = detectRecordingPasses(show.items);
    if (!passes.length) return;
    const total = passes.reduce((sum, pass) => sum + pass.duration, 0);
    totalShowLength += total;
    showsWithLength += 1;
    allSetLengths.push(...passes.map((pass) => pass.duration));
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
    statsContent.innerHTML = activeTracker
      ? `<div class="empty">Add some shows to see stats.</div>`
      : `<div class="empty">Open an archive to see stats.</div>`;
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
  renderTrackerState();
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
