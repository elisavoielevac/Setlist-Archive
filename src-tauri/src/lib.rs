use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const MANAGED_TRACKERS_DIRECTORY: &str = "Trackers";
const TRACKER_FILE_EXTENSION: &str = ".setlisttracker";

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    eprintln!("[Tauri drop] Reading dropped file: {path}");
    std::fs::read_to_string(&path)
        .inspect(|text| eprintln!("[Tauri drop] Read {} bytes from {path}", text.len()))
        .map_err(|error| {
            eprintln!("[Tauri drop] Failed to read {path}: {error}");
            error.to_string()
        })
}

#[tauri::command]
fn read_tracker_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_tracker_file_atomic(path: String, contents: String) -> Result<(), String> {
    write_file_atomically(Path::new(&path), contents.as_bytes()).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_managed_tracker_file(app: AppHandle, name: String) -> Result<String, String> {
    let directory = managed_trackers_dir(&app)?;
    read_managed_tracker_file_in_dir(&directory, &name)
}

#[tauri::command]
fn write_managed_tracker_file(
    app: AppHandle,
    name: String,
    contents: String,
) -> Result<(), String> {
    let directory = managed_trackers_dir(&app)?;
    write_managed_tracker_file_in_dir(&directory, &name, contents.as_bytes())
}

#[tauri::command]
fn list_managed_tracker_files(app: AppHandle) -> Result<Vec<String>, String> {
    let directory = managed_trackers_dir(&app)?;
    list_managed_tracker_files_in_dir(&directory).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_last_tracker_name(app: AppHandle) -> Result<Option<String>, String> {
    managed_trackers_dir(&app)?;
    if let Err(error) = clear_legacy_last_tracker_path(&app) {
        eprintln!("Failed to clear legacy last-tracker-path preference: {error}");
    }

    let path = last_tracker_name_preference_path(&app)?;
    match fs::read_to_string(path) {
        Ok(name) if name.is_empty() => Ok(None),
        Ok(name) => Ok(Some(name)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn write_last_tracker_name(app: AppHandle, name: String) -> Result<(), String> {
    let preference_path = last_tracker_name_preference_path(&app)?;
    let name = normalize_managed_tracker_name(&name)?;
    write_file_atomically(&preference_path, name.as_bytes()).map_err(|error| error.to_string())
}

#[tauri::command]
fn clear_last_tracker_name(app: AppHandle) -> Result<(), String> {
    let path = last_tracker_name_preference_path(&app)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn last_tracker_name_preference_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("last-tracker-name"))
}

fn clear_legacy_last_tracker_path(app: &AppHandle) -> Result<(), String> {
    let path = app_data_dir(app)?.join("last-tracker-path");
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn managed_trackers_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_data_dir(app)?;
    managed_trackers_dir_from_app_data(&app_data_dir).map_err(|error| error.to_string())
}

fn managed_trackers_dir_from_app_data(app_data_dir: &Path) -> io::Result<PathBuf> {
    let directory = app_data_dir.join(MANAGED_TRACKERS_DIRECTORY);
    fs::create_dir_all(&directory)?;
    Ok(directory)
}

fn normalize_managed_tracker_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Tracker name cannot be empty".into());
    }
    if name == "." || name == ".." {
        return Err("Tracker name cannot be . or ..".into());
    }
    if name.contains('/') || name.contains('\\') {
        return Err("Tracker name must not contain path separators".into());
    }
    if name.contains('\0') {
        return Err("Tracker name contains an invalid character".into());
    }

    let normalized = if has_tracker_file_extension(name) {
        name.to_owned()
    } else {
        format!("{name}{TRACKER_FILE_EXTENSION}")
    };
    let stem = &normalized[..normalized.len() - TRACKER_FILE_EXTENSION.len()];
    if stem.trim().is_empty() {
        return Err("Tracker name must include a filename stem".into());
    }
    Ok(normalized)
}

fn resolve_managed_tracker_path(trackers_dir: &Path, name: &str) -> Result<PathBuf, String> {
    let filename = normalize_managed_tracker_name(name)?;
    let path = trackers_dir.join(&filename);
    if path.parent() != Some(trackers_dir) {
        return Err("Managed tracker path must remain inside the Trackers directory".into());
    }
    Ok(path)
}

fn read_managed_tracker_file_in_dir(trackers_dir: &Path, name: &str) -> Result<String, String> {
    let path = resolve_managed_tracker_path(trackers_dir, name)?;
    fs::read_to_string(path).map_err(|error| error.to_string())
}

fn write_managed_tracker_file_in_dir(
    trackers_dir: &Path,
    name: &str,
    contents: &[u8],
) -> Result<(), String> {
    let path = resolve_managed_tracker_path(trackers_dir, name)?;
    write_file_atomically(&path, contents).map_err(|error| error.to_string())
}

fn has_tracker_file_extension(name: &str) -> bool {
    name.to_ascii_lowercase().ends_with(TRACKER_FILE_EXTENSION)
}

fn list_managed_tracker_files_in_dir(trackers_dir: &Path) -> io::Result<Vec<String>> {
    let mut tracker_names = Vec::new();

    for entry in fs::read_dir(trackers_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        if has_tracker_file_extension(&name) && normalize_managed_tracker_name(&name).is_ok() {
            let Ok(resolved_path) = resolve_managed_tracker_path(trackers_dir, &name) else {
                continue;
            };
            if resolved_path == entry.path() {
                tracker_names.push(name);
            }
        }
    }

    tracker_names.sort_unstable_by(|left, right| {
        left.to_lowercase()
            .cmp(&right.to_lowercase())
            .then_with(|| left.cmp(right))
    });
    Ok(tracker_names)
}

fn write_file_atomically(path: &Path, contents: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "Tracker path has no parent directory",
            )
        })?;
    let file_name = path.file_name().ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidInput, "Tracker path has no file name")
    })?;
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary_path = parent.join(format!(".{}.{}.tmp", file_name.to_string_lossy(), unique));
    let mut temporary_file_created = false;

    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)?;
        temporary_file_created = true;
        file.write_all(contents)?;
        file.sync_all()?;
        fs::rename(&temporary_path, path)?;

        if let Ok(directory) = File::open(parent) {
            let _ = directory.sync_all();
        }
        Ok(())
    })();

    if result.is_err() && temporary_file_created {
        let _ = fs::remove_file(&temporary_path);
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            read_tracker_file,
            write_tracker_file_atomic,
            read_managed_tracker_file,
            write_managed_tracker_file,
            list_managed_tracker_files,
            read_last_tracker_name,
            write_last_tracker_name,
            clear_last_tracker_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running Reaper Setlist Tracker");
}

#[cfg(test)]
mod tests {
    use super::{
        list_managed_tracker_files_in_dir, managed_trackers_dir_from_app_data,
        normalize_managed_tracker_name, read_managed_tracker_file_in_dir,
        resolve_managed_tracker_path, write_file_atomically, write_managed_tracker_file_in_dir,
    };
    use std::{
        fs, process,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn atomically_replaces_existing_tracker_contents() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "reaper-setlist-tracker-{}/{}",
            process::id(),
            unique
        ));
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("test.setlisttracker");
        fs::write(&path, "old contents").unwrap();

        write_file_atomically(&path, b"new contents").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "new contents");
        assert_eq!(fs::read_dir(&directory).unwrap().count(), 1);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn normalizes_tracker_stems_and_extensions() {
        assert_eq!(
            normalize_managed_tracker_name("LVDN"),
            Ok("LVDN.setlisttracker".into())
        );
        assert_eq!(
            normalize_managed_tracker_name("Artist 2026.setlisttracker"),
            Ok("Artist 2026.setlisttracker".into())
        );
        assert_eq!(
            normalize_managed_tracker_name("Artist 2026.SETLISTTRACKER"),
            Ok("Artist 2026.SETLISTTRACKER".into())
        );
    }

    #[test]
    fn rejects_invalid_or_path_like_tracker_names() {
        for name in [
            "",
            "   ",
            ".",
            "..",
            ".setlisttracker",
            "../LVDN",
            "a/b",
            "a\\b",
        ] {
            assert!(
                normalize_managed_tracker_name(name).is_err(),
                "{name:?} should be rejected"
            );
        }
    }

    #[test]
    fn resolves_tracker_paths_only_inside_the_managed_directory() {
        let app_data_directory = unique_temp_directory("managed-tracker-path");
        let trackers_directory = managed_trackers_dir_from_app_data(&app_data_directory).unwrap();

        let path = resolve_managed_tracker_path(&trackers_directory, "LVDN").unwrap();
        assert_eq!(path, trackers_directory.join("LVDN.setlisttracker"));
        assert!(resolve_managed_tracker_path(&trackers_directory, "../outside").is_err());

        fs::remove_dir_all(app_data_directory).unwrap();
    }

    #[test]
    fn lists_regular_tracker_files_in_case_insensitive_name_order() {
        let directory = unique_temp_directory("managed-tracker-list");
        fs::write(directory.join("Zeta.setlisttracker"), "{}").unwrap();
        fs::write(directory.join("alpha.setlisttracker"), "{}").unwrap();
        fs::write(directory.join("Beta.SETLISTTRACKER"), "{}").unwrap();
        fs::write(directory.join("notes.txt"), "").unwrap();
        fs::write(directory.join(".setlisttracker"), "{}").unwrap();
        fs::create_dir(directory.join("nested.setlisttracker")).unwrap();

        assert_eq!(
            list_managed_tracker_files_in_dir(&directory).unwrap(),
            vec![
                "alpha.setlisttracker",
                "Beta.SETLISTTRACKER",
                "Zeta.setlisttracker"
            ]
        );

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn reads_and_writes_managed_trackers_by_filename() {
        let directory = unique_temp_directory("managed-tracker-read-write");

        write_managed_tracker_file_in_dir(&directory, "LVDN", b"first contents").unwrap();
        assert_eq!(
            read_managed_tracker_file_in_dir(&directory, "LVDN.setlisttracker").unwrap(),
            "first contents"
        );

        write_managed_tracker_file_in_dir(&directory, "LVDN.setlisttracker", b"updated contents")
            .unwrap();
        assert_eq!(
            read_managed_tracker_file_in_dir(&directory, "LVDN").unwrap(),
            "updated contents"
        );
        assert!(read_managed_tracker_file_in_dir(&directory, "../outside").is_err());

        fs::remove_dir_all(directory).unwrap();
    }

    fn unique_temp_directory(label: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "reaper-setlist-tracker-{label}-{}/{}",
            process::id(),
            unique
        ));
        fs::create_dir_all(&directory).unwrap();
        directory
    }
}
