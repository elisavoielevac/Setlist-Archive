# Reaper Setlist Archive

A free, open-source macOS app that turns REAPER song markers into searchable concert archives, with setlists, detected recording lengths, tour notes, and song statistics.

## About the app

Built for musicians and recording engineers who record concerts in REAPER, Reaper Setlist Archive helps answer questions such as “When did we last play this song?” and “How long were the recorded sets?”

Import `.rpp` projects or marker `.csv` exports, organize shows into artist, band, or tour archives, and search songs and show details across each archive. Add venue, lineup, tour, and notes; compare the most-played songs and recorded show lengths; and export archives for backup or transfer.

The app is tailored to projects with named song markers and recording blocks that start and stop together across tracks. Recording lengths are inferred from project item timings. It reads project information without modifying the source files or requiring the referenced audio files. It does not recognize songs from audio or measure individual song durations.

See [the user manual](USER_MANUAL.md) for the workflow, examples, and limitations.

## Beta status

Current configured version: **0.1.0-beta.1**. The next downloadable beta is being prepared.

The current build is for **Apple Silicon Macs**. Intel support is optional and has not been built or tested yet. A signed, notarized DMG and confirmed macOS requirements are planned for the release; this repository does not yet document a verified public installer.

## What it does

An **Archive** is one artist, band, or tour database. Each archive contains **Shows**, and each show contains **Songs** imported from REAPER markers.

The app keeps archives in a managed, app-owned library and provides:

- Create, open, rename, duplicate, delete, and reveal archives in Finder
- Import and export `.setlistarchive` files
- Autosave and last-active-archive session restore
- Readable show details with an expandable editor, bulk metadata editing, chronological sorting, search, and statistics
- Single-show and bulk deletion confirmation
- Archive-wide Ignore Songs rules for utility markers and other non-song cues
- Automatic recording-set detection using cross-track timing agreement, supporting gaps between sets and back-to-back sets
- A five-minute minimum for detected sets, excluding shorter blocks and gaps between sets from recording totals
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

## Workflow limitations

- A song entry comes from a marker, not audio recognition. Consistent marker names produce more useful statistics.
- Marker timestamps are positions in the original project, not song durations.
- Detected sets describe recording blocks. A continuous recording across a break may remain one set; a recording failure and restart can create separate sets.
- Recording blocks shorter than five minutes are excluded even if they represent a genuine short set or encore. Exactly five minutes counts.
- CSV imports contain markers only, so they have no detected recording lengths.
- Imported shows do not automatically follow later changes to the source project.
- Ignore rules apply to matching names across the active archive and do not change recording lengths.
- Archives are stored locally. Export backups yourself; there is no cloud synchronization.

## Archive files and persistence

Archive files use the `.setlistarchive` extension and are stored as JSON using the `reaper-setlist-archive` format. Managed archives are kept in the application data directory; the frontend works with archive names rather than managed-library paths.

Archive import and export are available from **Archive actions → Manage archives**. Exporting does not change the active archive or redirect autosaves.

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
node --test recording-passes.test.js
node --check app.js
node --check tracker-persistence.js
git diff --check
```

The current beta does not support `.txt` show imports. Unsupported dropped files are rejected without creating a show.

## License

This project is licensed under the [MIT License](LICENSE). You may use, modify, and redistribute it, including commercially, provided you retain the copyright and license notices. Third-party dependencies retain their own licenses.

Maintenance and support are best-effort. Feature requests and contributions are welcome, but acceptance and delivery dates are not guaranteed. Modified versions and forks are maintained by their respective authors.
