use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

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
fn read_last_tracker_path(app: AppHandle) -> Result<Option<String>, String> {
    let path = last_tracker_preference_path(&app)?;
    match fs::read_to_string(path) {
        Ok(path) if path.is_empty() => Ok(None),
        Ok(path) => Ok(Some(path)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn write_last_tracker_path(app: AppHandle, path: String) -> Result<(), String> {
    let preference_path = last_tracker_preference_path(&app)?;
    write_file_atomically(&preference_path, path.as_bytes()).map_err(|error| error.to_string())
}

#[tauri::command]
fn clear_last_tracker_path(app: AppHandle) -> Result<(), String> {
    let path = last_tracker_preference_path(&app)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn last_tracker_preference_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    Ok(app_data_dir.join("last-tracker-path"))
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
            read_last_tracker_path,
            write_last_tracker_path,
            clear_last_tracker_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Reaper Setlist Tracker");
}

#[cfg(test)]
mod tests {
    use super::write_file_atomically;
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
}
