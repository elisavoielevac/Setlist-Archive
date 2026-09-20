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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_text_file])
        .run(tauri::generate_context!())
        .expect("error while running Reaper Setlist Tracker");
}
