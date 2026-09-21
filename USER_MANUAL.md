# Reaper Setlist Archive

Reaper Setlist Archive helps you keep a searchable record of recorded concerts, their songs, and show notes. It is designed for quick use during and after a tour.

## Core concepts

- **Archive** — one artist, band, or tour database.
- **Show** — one concert inside an archive.
- **Song** — one REAPER marker/song entry inside a show.

## Getting started

1. Launch Reaper Setlist Archive.
2. Select **New Archive** and enter an archive name.
3. Select **Manage Archives** to open an existing archive. Select an archive in the list, then choose **Open**.
4. Add shows by choosing files or dropping them into the import area.

Changes are saved automatically. The app shows **Saving…**, **Saved**, or **Save failed** in the archive bar. When the app starts, it attempts to reopen the last active archive.

## Managing archives

Choose **Manage Archives** to select an archive and use its actions:

- **Open** — make the selected archive active.
- **Rename** — change its name without changing its contents.
- **Duplicate** — create a copy of the selected archive.
- **Show in Finder** — reveal the managed archive file in Finder.
- **Import** — bring a `.setlistarchive` file into the managed archive library.
- **Export** — save the selected archive outside the managed library.
- **Delete** — permanently remove the selected archive after confirmation.

The **Ignored Songs** control is available for the active archive. It opens a list where you can review or unignore archive-wide ignored song names.

Archive files use the `.setlistarchive` extension. Importing an archive does not automatically make it active. Exporting an archive does not change the active archive or where future autosaves go.

## Importing shows

The supported show formats are:

- `.rpp` REAPER project files
- `.csv` marker exports

You can import shows with the file picker or by dragging files into the app. Native macOS drag and drop also supports a mix of files and show folders.

### Folder imports

Folder importing is intentionally shallow. A dropped folder must contain exactly one `.rpp` file directly inside it.

- Folders are not searched recursively.
- A folder with no direct `.rpp` is skipped.
- A folder with multiple direct `.rpp` files is skipped instead of choosing one.

The same source file cannot be imported twice into the same archive. The app identifies an identical source by its contents, so changing the show’s date, venue, or name later does not allow the same file to be imported again. The same source file can be used in another archive.

The filename can provide initial show metadata. A valid date at the beginning of the filename is recognized in either `YYYYMMDD` or `YYYY-MM-DD` form. The text after the date is used as the initial venue and show name. Invalid dates are not imported as dates; you can edit the show metadata after import.

`.txt` show imports are not supported.

## REAPER project imports

When a `.rpp` file is imported:

- REAPER markers become Songs in the Show.
- Quoted and unquoted marker names are supported.
- Repeated marker names remain separate song occurrences.
- The app identifies the relevant recording region and displays detected recording sets when valid audio items are present.
- Recording start, end, and set boundaries use timing agreement across recorded tracks, which helps ignore isolated outlier tracks.

Recording information is shown in the expanded show card as **Set 1**, **Set 2**, and so on, followed by **Total**. Shows without usable recording items do not display recording duration information.

## Editing a show

Click a Show to expand it. The editable fields are:

- **Date**
- **Venue / city**
- **Show name**
- **Tour**
- **Band lineup**
- **Notes**

Dates are displayed and entered as `DD-MM-YYYY`, for example `28-02-2026`. Dates are stored internally in `YYYY-MM-DD` form. The list remains chronologically sorted, with shows without dates at the end.

Changes are saved automatically when an edited field is committed, normally when you leave the field. Date edits are validated as real calendar dates before they are saved. If a date change moves the Show in the sorted list, the app keeps that Show expanded and brings it back into view.

## Ignore Songs

Use **Ignore** beside a marker in an expanded Show to ignore that song name across the active Archive. This is useful for repeated utility or show-control markers that are not songs, such as introductions or presentation cues.

Ignored markers remain visible in the Show for historical accuracy, but they are muted and marked **Ignored**. They are excluded from song counts, song statistics, and song search.

Choose **Ignored Songs** in the archive bar to review all ignored names or choose **Unignore**. Ignore rules belong to the active Archive and are saved with it.

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

Recording statistics use the same automatic recording-pass detection shown in the Show cards.

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

Use **Manage Archives → Export** to save an archive as a `.setlistarchive` file outside the managed library. Keep exported files as backups or transfer them to another Mac running Reaper Setlist Archive.

To bring one back into the app, use **Manage Archives → Import**. If the archive name already exists, choose a different name. Exported archives contain the archive’s Shows and ignored-song rules.

## Beta notes

This manual describes **Reaper Setlist Archive 0.1.0-beta.1**, the feature-frozen tour beta. The app is designed for macOS and currently supports `.rpp` and `.csv` show imports only.
