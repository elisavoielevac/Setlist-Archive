# Reaper Setlist Archive

Reaper Setlist Archive is a macOS desktop app for organizing recorded concerts into searchable artist, band, or tour archives.

## Beta status

Current release: **0.1.0-beta.1**

This build is feature-frozen for tour beta testing.

## What it does

An **Archive** is one artist, band, or tour database. Each archive contains **Shows**, and each show contains **Songs** imported from REAPER markers.

The app keeps archives in a managed, app-owned library and provides:

- Create, open, rename, duplicate, delete, and reveal archives in Finder
- Import and export `.setlistarchive` files
- Autosave and last-active-archive session restore
- Show metadata editing, chronological sorting, search, and statistics
- Single-show and bulk deletion confirmation
- Archive-wide Ignore Songs rules for utility markers and other non-song cues
- Automatic recording-pass and set detection using cross-track timing consensus
- Recording-bound consensus that ignores isolated long-running tracks such as MTC
- Dark and light themes with a persisted top-right toggle

## Importing shows

Supported show files are:

- `.rpp` REAPER project files
- `.csv` marker exports with marker names and start times

You can use the file picker, browser drop area, or native macOS drag and drop. Native folder drops are intentionally shallow: a folder must contain exactly one direct `.rpp` file. Subfolders are not scanned, and folders containing zero or multiple direct `.rpp` files are rejected.

Imported filenames may provide a date and venue. Date prefixes in `YYYYMMDD` and `YYYY-MM-DD` form are recognized when they contain a valid calendar date. Dates are stored as `YYYY-MM-DD` and displayed and edited as `DD-MM-YYYY`.

REAPER marker parsing supports quoted and unquoted marker names, and repeated marker names remain separate song occurrences.

Importing the same source file into the same archive is prevented using a SHA-256 fingerprint of the complete source contents. The same source can still be imported into another archive.

## Archive files and persistence

Archive files use the `.setlistarchive` extension and are stored as JSON using the `reaper-setlist-archive` format. Managed archives are kept in the application data directory; the frontend works with archive names rather than managed-library paths.

Archive import and export are available from **Manage Archives**. Exporting does not change the active archive or redirect autosaves.

## Development

Requirements:

- macOS
- Rust toolchain
- Tauri 2 CLI

The frontend is plain HTML, CSS, and JavaScript. Native filesystem and application-data operations are implemented in Rust.

To run the desktop app during development:

```sh
cargo tauri dev
```

## Build and verification

Build the macOS application bundle with:

```sh
cargo tauri build --bundles app
```

The project’s standard verification commands are:

```sh
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo tauri build --bundles app
node --check app.js
node --check tracker-persistence.js
git diff --check
```

The current beta does not support `.txt` show imports. Unsupported dropped files are rejected without creating a show.

## License

No license file is currently included in this repository.
