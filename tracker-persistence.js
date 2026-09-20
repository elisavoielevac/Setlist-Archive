(() => {
  const LOCAL_STORAGE_KEY = "setlist-archive-shows-v1";
  const TRACKER_FORMAT = "reaper-setlist-tracker";
  const TRACKER_SCHEMA_VERSION = 1;

  function loadActiveShows() {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];

    const shows = JSON.parse(raw);
    if (!Array.isArray(shows)) throw new Error("Saved show data is not an array");
    return shows;
  }

  function saveActiveShows(shows) {
    if (!Array.isArray(shows)) throw new TypeError("Shows must be an array");
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(shows));
  }

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

  window.trackerPersistence = {
    loadActiveShows,
    saveActiveShows,
    validateTrackerData,
    parseTrackerFile,
    serializeTrackerFile,
  };
})();
