(() => {
  const TRACKER_FORMAT = "reaper-setlist-archive";
  const TRACKER_SCHEMA_VERSION = 1;
  let trackerWriteQueue = Promise.resolve();
  let trackerWriteError = null;

  function normalizeShowText(value, field, showIndex) {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") {
      throw new TypeError(`Archive show ${showIndex} field ${field} must be a string`);
    }
    return value;
  }

  function normalizeShow(show, showIndex) {
    if (!show || typeof show !== "object" || Array.isArray(show)) {
      throw new TypeError(`Archive show ${showIndex} must be an object`);
    }
    if (typeof show.id !== "string" || !show.id.trim()) {
      throw new TypeError(`Archive show ${showIndex} must have a valid id`);
    }

    const markers = show.markers === undefined || show.markers === null ? [] : show.markers;
    if (!Array.isArray(markers)) {
      throw new TypeError(`Archive show ${showIndex} markers must be an array`);
    }
    const normalizedMarkers = markers.map((marker, markerIndex) => {
      if (!marker || typeof marker !== "object" || Array.isArray(marker)) {
        throw new TypeError(`Archive show ${showIndex} marker ${markerIndex} must be an object`);
      }
      if (typeof marker.time !== "number" || !Number.isFinite(marker.time)) {
        throw new TypeError(`Archive show ${showIndex} marker ${markerIndex} time must be finite`);
      }
      return {
        ...marker,
        time: marker.time,
        name: normalizeShowText(marker.name, "marker name", `${showIndex}/${markerIndex}`),
      };
    });

    const items = show.items === undefined || show.items === null ? [] : show.items;
    if (!Array.isArray(items)) {
      throw new TypeError(`Archive show ${showIndex} items must be an array`);
    }
    const normalizedItems = items.map((item, itemIndex) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new TypeError(`Archive show ${showIndex} item ${itemIndex} must be an object`);
      }
      if (typeof item.position !== "number" || !Number.isFinite(item.position)) {
        throw new TypeError(`Archive show ${showIndex} item ${itemIndex} position must be finite`);
      }
      if (typeof item.length !== "number" || !Number.isFinite(item.length)) {
        throw new TypeError(`Archive show ${showIndex} item ${itemIndex} length must be finite`);
      }
      if (item.track !== undefined && item.track !== null
        && (typeof item.track !== "number" || !Number.isFinite(item.track))) {
        throw new TypeError(`Archive show ${showIndex} item ${itemIndex} track must be finite`);
      }
      return { ...item };
    });

    if (show.addedAt !== undefined && (typeof show.addedAt !== "number" || !Number.isFinite(show.addedAt))) {
      throw new TypeError(`Archive show ${showIndex} addedAt must be finite`);
    }

    const normalizedShow = {
      ...show,
      name: normalizeShowText(show.name, "name", showIndex),
      date: normalizeShowText(show.date, "date", showIndex),
      venue: normalizeShowText(show.venue, "venue", showIndex),
      tour: normalizeShowText(show.tour, "tour", showIndex),
      lineup: normalizeShowText(show.lineup, "lineup", showIndex),
      notes: normalizeShowText(show.notes, "notes", showIndex),
      markers: normalizedMarkers,
      items: normalizedItems,
      addedAt: show.addedAt === undefined ? 0 : show.addedAt,
    };

    if (show.sourceFingerprint === null || show.sourceFingerprint === undefined) {
      delete normalizedShow.sourceFingerprint;
    } else if (typeof show.sourceFingerprint !== "string" || !/^sha256:[0-9a-f]{64}$/.test(show.sourceFingerprint)) {
      throw new TypeError(`Archive show ${showIndex} sourceFingerprint is invalid`);
    }

    return normalizedShow;
  }

  function validateTrackerData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new TypeError("Archive data must be an object");
    }
    if (data.format !== TRACKER_FORMAT) {
      throw new Error(`Unsupported archive format: ${String(data.format)}`);
    }
    if (data.schemaVersion !== TRACKER_SCHEMA_VERSION) {
      throw new Error(`Unsupported archive schema version: ${String(data.schemaVersion)}`);
    }
    if (!Number.isFinite(data.createdAt) || !Number.isFinite(data.updatedAt)) {
      throw new TypeError("Archive timestamps must be finite numbers");
    }
    if (!Array.isArray(data.shows)) {
      throw new TypeError("Archive shows must be an array");
    }
    if (data.ignoredSongNames === undefined) data.ignoredSongNames = [];
    if (!Array.isArray(data.ignoredSongNames)) {
      throw new TypeError("Archive ignored song names must be an array");
    }
    if (!data.ignoredSongNames.every((name) => typeof name === "string")) {
      throw new TypeError("Archive ignored song names must be strings");
    }
    data.shows = data.shows.map(normalizeShow);
    return data;
  }

  function parseTrackerFile(contents) {
    let data;
    try {
      data = JSON.parse(contents);
    } catch (error) {
      throw new Error(`Archive file is not valid JSON: ${error.message}`);
    }
    return validateTrackerData(data);
  }

  function serializeTrackerFile(shows, createdAt = Date.now(), updatedAt = Date.now(), ignoredSongNames = []) {
    const data = {
      format: TRACKER_FORMAT,
      schemaVersion: TRACKER_SCHEMA_VERSION,
      createdAt,
      updatedAt,
      shows,
      ignoredSongNames,
    };
    validateTrackerData(data);
    return `${JSON.stringify(data, null, 2)}\n`;
  }

  function tauriInvoke() {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) throw new Error("Archive files require the Tauri desktop app");
    return invoke;
  }

  async function readTrackerFile(path) {
    const contents = await tauriInvoke()("read_tracker_file", { path });
    return parseTrackerFile(contents);
  }

  async function listManagedTrackerFiles() {
    return tauriInvoke()("list_managed_tracker_files");
  }

  async function readManagedTrackerFile(name) {
    const contents = await tauriInvoke()("read_managed_tracker_file", { name });
    return parseTrackerFile(contents);
  }

  async function writeTrackerFile(path, shows, createdAt, updatedAt, ignoredSongNames = []) {
    const contents = serializeTrackerFile(shows, createdAt, updatedAt, ignoredSongNames);
    await tauriInvoke()("write_tracker_file_atomic", { path, contents });
    return parseTrackerFile(contents);
  }

  async function writeManagedTrackerFile(name, shows, createdAt, updatedAt, ignoredSongNames = []) {
    const contents = serializeTrackerFile(shows, createdAt, updatedAt, ignoredSongNames);
    await tauriInvoke()("write_managed_tracker_file", { name, contents });
    return parseTrackerFile(contents);
  }

  async function renameManagedTrackerFile(oldName, newName) {
    return tauriInvoke()("rename_managed_tracker_file", { oldName, newName });
  }

  async function deleteManagedTrackerFile(name) {
    await tauriInvoke()("delete_managed_tracker_file", { name });
  }

  async function revealManagedTrackerFile(name) {
    await tauriInvoke()("reveal_managed_tracker_file", { name });
  }

  function queueTrackerFileWrite(path, shows, createdAt, updatedAt = Date.now(), ignoredSongNames = []) {
    const contents = serializeTrackerFile(shows, createdAt, updatedAt, ignoredSongNames);
    const write = trackerWriteQueue.then(async () => {
      await tauriInvoke()("write_tracker_file_atomic", { path, contents });
      return parseTrackerFile(contents);
    });

    trackerWriteQueue = write.then(
      () => {
        trackerWriteError = null;
      },
      (error) => {
        trackerWriteError = error;
      },
    );
    return write;
  }

  function queueManagedTrackerFileWrite(name, shows, createdAt, updatedAt = Date.now(), ignoredSongNames = []) {
    const contents = serializeTrackerFile(shows, createdAt, updatedAt, ignoredSongNames);
    const write = trackerWriteQueue.then(async () => {
      await tauriInvoke()("write_managed_tracker_file", { name, contents });
      return parseTrackerFile(contents);
    });

    trackerWriteQueue = write.then(
      () => {
        trackerWriteError = null;
      },
      (error) => {
        trackerWriteError = error;
      },
    );
    return write;
  }

  async function waitForTrackerFileWrites() {
    await trackerWriteQueue;
    if (trackerWriteError) throw trackerWriteError;
  }

  function clearTrackerWriteError() {
    trackerWriteError = null;
  }

  async function readLastTrackerName() {
    return tauriInvoke()("read_last_tracker_name");
  }

  async function writeLastTrackerName(name) {
    await tauriInvoke()("write_last_tracker_name", { name });
  }

  async function clearLastTrackerName() {
    await tauriInvoke()("clear_last_tracker_name");
  }

  async function readThemePreference() {
    return tauriInvoke()("read_theme_preference");
  }

  async function writeThemePreference(theme) {
    await tauriInvoke()("write_theme_preference", { theme });
  }

  window.trackerPersistence = {
    validateTrackerData,
    parseTrackerFile,
    serializeTrackerFile,
    readTrackerFile,
    listManagedTrackerFiles,
    readManagedTrackerFile,
    writeTrackerFile,
    writeManagedTrackerFile,
    renameManagedTrackerFile,
    deleteManagedTrackerFile,
    revealManagedTrackerFile,
    queueTrackerFileWrite,
    queueManagedTrackerFileWrite,
    waitForTrackerFileWrites,
    clearTrackerWriteError,
    readLastTrackerName,
    writeLastTrackerName,
    clearLastTrackerName,
    readThemePreference,
    writeThemePreference,
  };
})();
