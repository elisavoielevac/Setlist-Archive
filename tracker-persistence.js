(() => {
  const TRACKER_FORMAT = "reaper-setlist-tracker";
  const TRACKER_SCHEMA_VERSION = 1;
  let trackerWriteQueue = Promise.resolve();
  let trackerWriteError = null;

  function validateTrackerData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new TypeError("Tracker data must be an object");
    }
    if (data.format !== TRACKER_FORMAT) {
      throw new Error(`Unsupported tracker format: ${String(data.format)}`);
    }
    if (data.schemaVersion !== TRACKER_SCHEMA_VERSION) {
      throw new Error(`Unsupported tracker schema version: ${String(data.schemaVersion)}`);
    }
    if (!Number.isFinite(data.createdAt) || !Number.isFinite(data.updatedAt)) {
      throw new TypeError("Tracker timestamps must be finite numbers");
    }
    if (!Array.isArray(data.shows)) {
      throw new TypeError("Tracker shows must be an array");
    }
    return data;
  }

  function parseTrackerFile(contents) {
    let data;
    try {
      data = JSON.parse(contents);
    } catch (error) {
      throw new Error(`Tracker file is not valid JSON: ${error.message}`);
    }
    return validateTrackerData(data);
  }

  function serializeTrackerFile(shows, createdAt = Date.now(), updatedAt = Date.now()) {
    const data = {
      format: TRACKER_FORMAT,
      schemaVersion: TRACKER_SCHEMA_VERSION,
      createdAt,
      updatedAt,
      shows,
    };
    validateTrackerData(data);
    return `${JSON.stringify(data, null, 2)}\n`;
  }

  function tauriInvoke() {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) throw new Error("Tracker files require the Tauri desktop app");
    return invoke;
  }

  async function readTrackerFile(path) {
    const contents = await tauriInvoke()("read_tracker_file", { path });
    return parseTrackerFile(contents);
  }

  async function writeTrackerFile(path, shows, createdAt, updatedAt) {
    const contents = serializeTrackerFile(shows, createdAt, updatedAt);
    await tauriInvoke()("write_tracker_file_atomic", { path, contents });
    return parseTrackerFile(contents);
  }

  function queueTrackerFileWrite(path, shows, createdAt, updatedAt = Date.now()) {
    const contents = serializeTrackerFile(shows, createdAt, updatedAt);
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

  async function waitForTrackerFileWrites() {
    await trackerWriteQueue;
    if (trackerWriteError) throw trackerWriteError;
  }

  function clearTrackerWriteError() {
    trackerWriteError = null;
  }

  async function readLastTrackerPath() {
    return tauriInvoke()("read_last_tracker_path");
  }

  async function writeLastTrackerPath(path) {
    await tauriInvoke()("write_last_tracker_path", { path });
  }

  async function clearLastTrackerPath() {
    await tauriInvoke()("clear_last_tracker_path");
  }

  window.trackerPersistence = {
    validateTrackerData,
    parseTrackerFile,
    serializeTrackerFile,
    readTrackerFile,
    writeTrackerFile,
    queueTrackerFileWrite,
    waitForTrackerFileWrites,
    clearTrackerWriteError,
    readLastTrackerPath,
    writeLastTrackerPath,
    clearLastTrackerPath,
  };
})();
