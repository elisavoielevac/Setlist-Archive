# Reaper Setlist Archive 0.1.0-beta.4

## Changes since beta.3

- Refresh the light theme with neutral backgrounds, white panels, and emerald accents
- Improve field boundaries, keyboard focus, search, and import-area readability
- Add subtle card shadows in the light theme
- Preserve the existing dark theme and app behavior

## Compatibility and testing

The beta.4 installer is Developer ID signed, accepted by Apple notarization, and stapled. Gatekeeper verification passed. The native beta.4 app launched on Apple Silicon with macOS 15.7.4, restored the existing archive view, and displayed the refreshed light theme. All 23 automated regression tests passed. A clean installation and REAPER project import with beta.4 have not been retested.

The universal macOS installer contains Apple Silicon and Intel executables. Beta.3 was previously installed and tested locally on Apple Silicon with macOS 15.7.4, and downloading and opening beta.3 was confirmed on a 2019 Intel Mac. REAPER project (`.rpp`) import on that Intel Mac remains untested; its macOS version was not recorded. These beta.3 results do not establish beta.4 installation compatibility. Minimum macOS compatibility remains unverified.

Archives are stored separately from the app. Export your archives for backup before updating, quit the old app, then replace it in Applications. Referenced audio files are not required to import a REAPER project.

---

# Reaper Setlist Archive 0.1.0-beta.3

Published as a GitHub pre-release. The signed beta.3 DMG was accepted by Apple notarization, its ticket was attached and validated, and local installation testing passed. Downloading and opening beta.3 was subsequently confirmed on a 2019 Intel Mac; `.rpp` import on that Mac remains untested.

## Changes since beta.1

- Use the supplied Reaper Setlist Archive app icon in the app bundle and installer
- Detect recording sets separated by gaps as well as back-to-back recordings; exclude breaks from recording totals
- Exclude detected recording blocks shorter than five minutes from set counts and recording-length statistics; exactly five minutes counts
- Compact the header and import area for populated archives, with Add shows beside search
- Show song counts, detected set counts, and recording totals in collapsed show rows
- Improve secondary-text readability and soften the light theme
- Show readable metadata with an expandable Edit details control
- Number songs while skipping ignored entries, and label marker timestamps as Position
- Group archive controls under Archive actions and collapse selection instructions under Selection help
- Clarify that ignoring song names applies across the active archive without changing recording lengths
- Update the user manual and app description, and adopt the MIT license
- Include the user manual and project license in the application bundle

## Compatibility and testing

Apple Silicon is the primary supported architecture. The universal build contains Apple Silicon and Intel executables; Intel support remains unverified on actual Intel hardware. Minimum macOS compatibility is not yet established through testing.

The app remains a local archive of REAPER marker information and recording item timings. CSV imports provide markers only. There is no audio playback or cloud synchronization. Export archives regularly for backup.

---

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
