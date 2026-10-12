# Reaper Setlist Archive

Reaper Setlist Archive is a macOS app for musicians and recording engineers who use named REAPER markers to document songs played at concerts. Import your projects into an archive, search past setlists, compare song counts and recording lengths, and keep tour details and notes together.

## Before you start

The app works best when each imported project represents one show, song names are stored in markers, and the recorded tracks share their recording start and stop times. Use consistent song names across shows so counts and statistics stay meaningful.

The app reads project information; it does not play audio, recognize songs from sound, or change your REAPER project files. Referenced audio files are not needed for importing marker names and recording item timings. Archives contain extracted show information, not the recordings themselves.

The current build is for Apple Silicon Macs. Intel support and the minimum supported macOS version will be confirmed during release testing.

## Core concepts

- **Archive** — one artist, band, or tour database.
- **Show** — one concert inside an archive.
- **Song** — one REAPER marker/song entry inside a show.

## Getting started

1. Launch Reaper Setlist Archive.
2. Choose **Archive actions → New archive** and enter an archive name. To use an existing archive instead, choose **Archive actions → Manage archives**, select it, and choose **Open**.
3. Choose **Add shows** to select `.rpp` or marker `.csv` files, or drop them into the import area. You can add several files at once.
4. Click a show to see its details, detected recording sets, and numbered songs. Choose **Edit details** to correct its date, venue, or other metadata.
5. Use search to find a song or show, or open **Stats** to compare your archive.

Changes are saved automatically. The app shows **Saving…**, **Saved**, or **Save failed** in the archive bar. When the app starts, it attempts to reopen the last active archive.

## Managing archives

Choose **Archive actions → Manage archives** to select an archive and use its actions:

- **Open** — make the selected archive active.
- **Rename** — change its name without changing its contents.
- **Duplicate** — create a copy of the selected archive.
- **Show in Finder** — reveal the managed archive file in Finder.
- **Import** — bring a `.setlistarchive` file into the managed archive library.
- **Export** — save the selected archive outside the managed library.
- **Delete** — permanently remove the selected archive after confirmation.

The **Archive actions → Ignored songs** control is available for the active archive. It opens a list where you can review or unignore archive-wide ignored song names.

Archive files use the `.setlistarchive` extension. Importing an archive does not automatically make it active. Exporting an archive does not change the active archive or where future autosaves go.

## Importing shows

The supported show formats are:

- `.rpp` REAPER project files
- `.csv` marker exports with column headings containing **Name** and **Start**

Choose **Add shows**, click the drop area, or drag files into the app. Native macOS drag and drop also supports a mix of files and show folders.

CSV start times can be expressed as seconds or colon-separated time, such as `4:16` or `1:04:16`. CSV imports provide song names and positions only; they do not provide recording items for set counts or recording lengths.

### Folder imports

Folder importing is intentionally shallow. A dropped folder must contain exactly one `.rpp` file directly inside it.

- Folders are not searched recursively.
- A folder with no direct `.rpp` is skipped.
- A folder with multiple direct `.rpp` files is skipped instead of choosing one.

The same source file cannot be imported twice into the same archive. The app identifies an identical source by its contents, so changing the show’s date, venue, or name later does not allow the same file to be imported again. The same source file can be used in another archive. Importing is a snapshot: later changes to the REAPER project do not automatically update the archived show. An edited source has different contents and can be imported as another show; it does not replace the previous entry.

The filename can provide initial show metadata. A valid date at the beginning of the filename is recognized in either `YYYYMMDD` or `YYYY-MM-DD` form. The text after the date is used as the initial venue and show name. Invalid dates are not imported as dates; you can edit the show metadata after import.

`.txt` show imports are not supported.

## REAPER project imports

When a `.rpp` file is imported:

- REAPER markers become Songs in the Show.
- Quoted and unquoted marker names are supported.
- Repeated marker names remain separate song occurrences.
- The app identifies the relevant recording region and displays detected recording sets when valid audio items are present.
- Recording start, end, and set boundaries use timing agreement across recorded tracks, which helps ignore isolated outlier tracks.

### How recording sets are counted

A detected set is a recording block inferred from shared track timings, not a group of song markers. A supported stop followed by a supported restart can separate sets with a gap of any length, including no gap. Gaps between detected blocks are excluded from the total.

- Blocks shorter than **5:00** are excluded from set counts, recording totals, and recording-length statistics.
- A block of exactly **5:00** counts.
- Excluded blocks are not merged into neighboring sets.
- Isolated outlier tracks, such as a long-running MTC track, normally do not extend the detected recording. MTC is not excluded by track name.

This rule is intended to discard short failed recordings. A genuine set or separately recorded encore shorter than five minutes will also be excluded. A recording failure followed by a restart can split a performance into multiple detected sets if each block lasts at least five minutes. One continuous recording spanning a break may be displayed as one set.

Recording lengths describe the retained recording blocks, including any speech or silence within them. They are not measured song-performance durations. Detection is automatic; there is no manual set-boundary editor.

Recording information is shown in the expanded show as **Set 1**, **Set 2**, and so on, followed by **Total**. Collapsed shows also display song count, detected set count, and total recording time when available. Shows without qualifying recording blocks show only the song count. These rules also apply to previously archived shows without reimporting them; excluding a short block does not remove its song markers.

### Reading the setlist

The **Position** column shows each marker's position on the original REAPER project timeline. For example, `4:16` means four minutes and sixteen seconds into the project; it is not the length of that song. Positions do not restart at zero for each detected set.

Song numbers follow marker order and skip ignored entries. Repeated names remain separate occurrences. Differences in spelling count as different songs; case and surrounding whitespace are ignored when matching names for song counts and ignore rules.

## Editing a show

Click a show to expand it, then choose **Edit details**. The editable fields are:

- **Date**
- **Venue / city**
- **Show name**
- **Tour**
- **Band lineup**
- **Notes**

Dates are displayed and entered as `DD-MM-YYYY`, for example `28-02-2026`. Dates are stored internally in `YYYY-MM-DD` form. The list remains chronologically sorted, with shows without dates at the end.

Changes are saved automatically when an edited field is committed, normally when you leave the field. Date edits are validated as real calendar dates before they are saved. If a date change moves the Show in the sorted list, the app keeps that Show expanded and brings it back into view.

## Editing several shows

Use the checkboxes to select shows. **Selection help** explains the shortcuts: Shift-click selects a range, and Command-click adds or removes individual shows.

Enter a tour, band lineup, or notes in the bulk-edit bar, then choose **Apply to selected**. Only filled-in fields are applied; blank fields leave existing values unchanged. A filled-in field replaces that field's value on every selected show.

## Ignore Songs

Use **Ignore** beside a marker in an expanded Show to ignore that song name across the active Archive. This is useful for repeated utility or show-control markers that are not songs, such as introductions or presentation cues.

Ignored markers remain visible in the Show for historical accuracy, but they are muted and marked **Ignored**. They are excluded from song counts, song statistics, and song search.

Choose **Archive actions → Ignored songs** to review all ignored names or choose **Unignore**. Ignore rules belong to the active archive and are saved with it. Matching ignores case and surrounding whitespace. Ignoring a name affects every matching occurrence in this archive, including future imports, and does not change recording lengths.

## Search

Use the search field near the top of the app. Search covers:

- Show name
- Date, including the displayed `DD-MM-YYYY` form
- Venue / city
- Tour
- Band lineup
- Notes
- Song names

Results are shown separately as song plays and matching Shows. Song results represent individual marker occurrences and show their timestamp. Select a result to switch to the Shows view, expand the containing Show, scroll it into view, and briefly highlight it. The main Show list is not filtered. Ignored songs do not appear as song results, but their containing Show can still match show metadata.

## Stats

Open the **Stats** tab to see:

- Total Shows
- Songs played, excluding ignored songs
- Unique songs, using case-insensitive trimmed song names
- Average show length for Shows with detected recording passes
- The most-played songs
- Longest and shortest detected show lengths
- Average detected set length

Recording statistics use the same automatic set detection shown in the show cards, including the five-minute minimum. Shows without qualifying recording blocks do not contribute to recording-length averages or longest/shortest comparisons. The displayed average is `0:00` when no shows have a qualifying recording length.

## Deleting shows

To delete one Show, expand it and choose **Delete show**. Confirm the action in the in-app confirmation dialog.

To delete several Shows:

1. Select their checkboxes. Shift-click or Command/Ctrl-click can help select a range or multiple Shows.
2. Choose **Delete Selected**.
3. Confirm the deletion.

Canceling either confirmation leaves the Shows unchanged.

## Appearance

Use the compact sun/moon toggle in the top-right corner to switch between dark and light themes. The choice is saved as an app preference and restored the next time you launch the app.

## Backup and portability

Use **Archive actions → Manage archives → Export** to save an archive as a `.setlistarchive` file outside the managed library. Keep exported files as backups or transfer them to another Mac running Reaper Setlist Archive.

To bring one back into the app, use **Archive actions → Manage archives → Import**. If the archive name already exists, choose a different name. Exported archives contain the archive’s shows and ignored-song rules, not audio recordings. Autosave maintains the working archive; it does not create a separate backup. Export a copy regularly and before deleting shows or archives.

## Beta notes

Reaper Setlist Archive is free and open source under the [MIT License](LICENSE). Maintenance and support are best-effort.

This manual describes the current macOS beta. Supported show imports are `.rpp` and marker `.csv` files. Archives are stored locally; there is no cloud synchronization. Installer instructions and confirmed system requirements will accompany the downloadable release.
