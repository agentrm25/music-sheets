# Data, Backups, and Privacy

Chart Creator stores application data locally. This document explains where data lives, what each save/export action contains, and how to protect a library from accidental loss.

## Storage model

Chart Creator has no user accounts, hosted database, or synchronization service. The application uses the current web origin's `localStorage` for:

- the current autosaved draft;
- saved library charts and their versions;
- groups;
- collected sections;
- theme and mirror-folder settings.

Each environment has its own origin and storage profile. These stores are separate:

- a browser opened at `http://localhost:1420`;
- another browser or browser profile;
- the installed production desktop application;
- the isolated QA desktop application.

Saving in one environment does not make a chart appear in another. Use JSON export/import to move data.

## What each action writes

| Action | Current draft | Local library | JSON file | Mirror folder | PDF |
| --- | --- | --- | --- | --- | --- |
| Edit a field or line | Autosaves after a short delay | No | No | No | No |
| Save to Library | Keeps autosaved draft | Creates or updates one chart | No | Writes one chart in desktop mode when configured | No |
| Export JSON | No change | No change | Writes current chart | No | No |
| Export PDF | No change | No change | No | No | Writes printable output |
| Delete from Library | No automatic draft deletion | Removes one library entry | No | Does not delete mirror files | No |

## Current draft versus library save

The autosaved draft is a recovery convenience, not a backup. It records the current editing state in the same storage profile as the library.

**Save to Library** creates or updates a separate library entry using the chart's internal ID. A chart can therefore have:

- a current draft with unsaved changes;
- a last saved library copy;
- optional manual versions inside the library entry;
- optional JSON files outside application storage.

Loading a library chart replaces the current draft. Chart Creator warns when it detects that the current chart differs from its library save.

## JSON export contents

**Export JSON** writes the normalized current chart, including:

- chart ID;
- title and artist;
- BPM, time signature, current key, original key, and capo;
- arrangement notes;
- group ID, status, source, and Info notes;
- sections, section settings, lines, and line content.

It does not export the complete application library or these separate collections:

- saved version history;
- group names/catalog;
- favorite flags;
- collected-section catalog;
- application theme;
- mirror-folder setting.

Because the JSON contains Info fields, treat it as private if those fields contain rehearsal notes, links, names, or other sensitive material.

## PDF contents

PDF export includes chart-facing content:

- title and artist;
- tempo, meter, keys, and capo;
- arrangement notes;
- section labels and repeat cues;
- chords, lyrics, instructions, and blank spacing;
- page counts.

It excludes workflow-only and editor-only fields:

- chart ID;
- group, status, source, and Info notes;
- favorites;
- saved versions and collected-section metadata;
- collapsed state and editor height;
- application theme and interface controls.

See [PDF Output Reference](PDF_OUTPUT.md) for the full output contract.

## Desktop mirror folder

The Tauri desktop application can write library saves to a selected folder as JSON.

### Filename and update behavior

- Mirror filenames are derived from the chart's internal ID, encoded to a filesystem-safe value.
- Renaming a chart updates the same mirror file.
- Two charts with the same title still receive different files.
- The mirror file contains current chart data, not the entire library, versions catalog, or collected-section catalog.

### Deletion behavior

Chart Creator intentionally does not delete mirror files when:

- a chart is deleted from the local library;
- the mirror-folder setting is cleared;
- a chart title changes.

This avoids silently deleting external files. It also means the mirror folder can retain older files that you must review and remove manually.

### Failure behavior

A local library save and a mirror write are separate operations. If local storage succeeds but the folder is missing, read-only, or otherwise unavailable, the chart remains saved locally and the application reports that the folder write failed.

## Backup strategy

For a small library:

1. Save each important chart to the library.
2. Export each chart as JSON after meaningful changes.
3. Store backups outside the application profile, preferably in a versioned or backed-up folder.
4. Test an import occasionally so you know the files are usable.

For desktop users with many charts:

1. Configure a dedicated mirror folder.
2. Keep that folder in a normal backup system.
3. Still export JSON before risky imports or large edits because mirror files update only on **Save to Library**.
4. Review stale mirror files manually after deleting library entries.

PDFs are print artifacts, not restorable chart backups. Use JSON for recovery.

## Recovery scenarios

### Browser or application data was cleared

The local draft, library, groups, versions, collected sections, and settings may be gone. Chart Creator cannot reconstruct them from `localStorage`. Import JSON backups or mirror files one chart at a time.

### Storage quota was exceeded

The browser/webview sets the storage quota. When a library write exceeds it, Chart Creator rejects the save and displays recovery guidance. Export the current chart as JSON before deleting older library entries.

Autosave can fail independently when storage is full. If the status bar says **Save failed**, do not assume the current edits will survive a restart.

### The selected mirror folder moved

Open Settings, clear or reselect the folder, and save the chart again. A failed mirror write does not automatically retry and does not remove earlier files.

### A chart was deleted from the library

Look for:

- an exported JSON backup;
- an ID-based JSON file in the desktop mirror folder;
- another browser/profile or device where the chart was exported.

Chart Undo does not restore library deletions.

## Privacy and network behavior

The application does not provide accounts, cloud synchronization, collaboration, analytics, or a hosted API. Production Content Security Policy settings restrict scripts and network connections to the packaged application itself.

Local-first does not mean encrypted:

- anyone with access to the operating-system account or browser profile may be able to read application storage;
- exported JSON and mirror files are plain text;
- PDFs contain visible chart content;
- operating-system backups may retain deleted files.

Do not store secrets or credentials in chart fields. Do not attach real charts, JSON exports, filesystem paths, or screenshots containing private content to public GitHub issues.

## Data format compatibility

Import normalizes legacy or incomplete chart records into the current structure. Unknown or invalid numeric values are constrained or discarded. IDs may be generated for older records that lack them.

Because this is pre-release software, keep the original backup when importing older files. Export a fresh copy only after checking the resulting chart.
