(() => {
  const TRACKER_FORMAT = "reaper-setlist-archive";
  const TRACKER_SCHEMA_VERSION = 1;
  let trackerWriteQueue = Promise.resolve();
  let trackerWriteError = null;

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

  async function writeTrackerFile(path, shows, createdAt, updatedAt) {
    const contents = serializeTrackerFile(shows, createdAt, updatedAt);
    await tauriInvoke()("write_tracker_file_atomic", { path, contents });
    return parseTrackerFile(contents);
  }

  async function writeManagedTrackerFile(name, shows, createdAt, updatedAt) {
    const contents = serializeTrackerFile(shows, createdAt, updatedAt);
    await tauriInvoke()("write_managed_tracker_file", { name, contents });
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

  function queueManagedTrackerFileWrite(name, shows, createdAt, updatedAt = Date.now()) {
    const contents = serializeTrackerFile(shows, createdAt, updatedAt);
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

  window.trackerPersistence = {
    validateTrackerData,
    parseTrackerFile,
    serializeTrackerFile,
    readTrackerFile,
    listManagedTrackerFiles,
    readManagedTrackerFile,
    writeTrackerFile,
    writeManagedTrackerFile,
    queueTrackerFileWrite,
    queueManagedTrackerFileWrite,
    waitForTrackerFileWrites,
    clearTrackerWriteError,
    readLastTrackerName,
    writeLastTrackerName,
    clearLastTrackerName,
  };
})();
