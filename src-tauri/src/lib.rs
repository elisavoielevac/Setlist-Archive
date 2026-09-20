use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

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
            write_tracker_file_atomic
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
