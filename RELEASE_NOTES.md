# Reaper Setlist Archive 0.1.0-beta.1

This is the first public tour beta of Reaper Setlist Archive. Core functionality is feature-frozen for real-world testing; changes during the beta should be limited to bug fixes and reliability improvements.

## Highlights

- Managed archive library for creating, opening, renaming, duplicating, deleting, and revealing Archives in Finder
- `.setlistarchive` archive import and export
- Autosave and last-active-Archive session restore
- `.rpp` and `.csv` Show imports through the file picker and drag and drop
- Shallow folder import for folders containing exactly one direct `.rpp` file
- Duplicate-Show prevention based on the source file contents
- Filename date inference for `YYYYMMDD` and `YYYY-MM-DD` prefixes
- Show metadata editing for date, venue, name, tour, lineup, and notes
- Automatic REAPER recording and set detection using agreement across recorded tracks
- Quoted and unquoted REAPER marker parsing, with repeated marker names preserved
- Archive-wide Ignore Songs rules
- Search across Shows, Songs, metadata, and dates
- Recording and song statistics
- Confirmation for single-Show and bulk Show deletion
- Persisted dark/light themes with a compact top-right toggle

## Supported imports

- `.rpp` — REAPER project files
- `.csv` — marker exports
- `.setlistarchive` — Archive import through **Manage Archives**

`.txt` Show imports are not supported.

## Beta notes

- macOS only
- Folder import is shallow and non-recursive; each dropped folder must contain exactly one direct `.rpp`
- Metadata and notes are saved when edits are committed, typically when leaving the field
- There is no cloud synchronization
- The beta is intended for real tour testing

## Testing focus

Beta testing should focus on:

- Importing real-world REAPER projects
- Archive persistence across edits and relaunches
- Duplicate detection
- Show metadata editing
- Search and statistics correctness
- Unexpected crashes or malformed archive handling
