# Chart Creator User Guide

This guide covers the installed desktop application and browser mode. Both interfaces work the same way unless a section explicitly calls out desktop-only behavior.

## Before you begin

Chart Creator is local-first. It does not create an online account or synchronize a library between devices. The current draft and saved library belong to the browser or desktop webview in which they were created.

For any chart you cannot afford to lose, save it to the library and export a JSON backup. See [Data, Backups, and Privacy](DATA_AND_PRIVACY.md) for the exact storage boundaries.

## Workspace overview

The application has two workspaces.

### Editor workspace

The Editor contains three panels:

1. **Song Details** stores title, artist, current key, original key, BPM, time signature, capo, arrangement notes, transposition controls, and a compact saved-chart list.
2. **Editor** contains the Sections, Versions, Info, and Collected tabs.
3. **Preview** shows the chart's print-oriented appearance, page-break estimates, theme control, and zoom controls.

At narrow window widths, toolbars scroll horizontally so all actions remain reachable.

### Library workspace

The Library provides larger cards for saved charts. Use it to:

- search titles and metadata;
- sort by newest, title, key, or group;
- filter by group;
- mark favorites;
- move charts between groups;
- open or delete a chart.

Deleting a chart from the library is permanent for local storage and requires confirmation. It does not remove a JSON mirror file previously written by the desktop application.

## Create a chart

Select **New Chart** in the top toolbar. Confirm the prompt if the current chart has unsaved changes.

A new chart starts with Intro, Verse, and Chorus sections. Enter any useful metadata:

| Field | Behavior |
| --- | --- |
| Title | Used in the library and as the base export filename. An empty title becomes “Untitled Chart” in the library and `chart` for exports. |
| Artist | Appears in the preview, PDF, and JSON. |
| Key | Current performance key. Transposition changes this field. |
| Original Key | Optional reference key. If blank, the first transposition captures the current key here. |
| BPM | Whole number from 20 through 300. |
| Time signature | Optional meter shown with BPM. |
| Capo | Optional capo position. |
| Arrangement notes | Public chart instructions shown in the preview and PDF. |

Changes update the preview immediately and are autosaved after a short delay. The status bar reports **Saving…**, **Auto-saved**, or **Save failed**.

## Add and configure sections

Choose a template from the section-template menu, then select **Add Section (Top)** or **Add Section (Bottom)**.

Available templates are:

- **Empty (default):** one chord row and one lyric row.
- **Verse – 4 bar:** four chord-and-lyric rows.
- **Chorus – 8 bar:** eight chord-and-lyric rows.
- **Bridge – 4 bar:** four chord-and-lyric rows.
- **Intro / Outro – chords only:** four chord rows.
- **Instrumental – 8 bar chords:** eight chord rows.

Each section card provides controls for:

- **Section type:** Intro, Verse, Chorus, Bridge, Outro, Instrumental, or Custom.
- **Verse number:** available on verse sections and constrained to 1–99. Verse sections are renumbered to follow chart order after reordering.
- **Custom label:** the printed heading for a Custom section.
- **Repeat count:** available on non-verse sections and constrained to 1–99.
- **Text size:** scales that section's preview and PDF typography from 100% through 200% in 10% steps.
- **Collapse/expand:** hides or shows the editing body without removing content.
- **Resize:** changes the section editor height; this affects the editor only, not output.
- **Duplicate:** copies the section with new internal identifiers.
- **Collect:** stores a reusable copy in the Collected tab.
- **Delete:** removes the section as an undoable chart edit.

Drag the section handle to reorder with a pointer. Keyboard users can focus the handle and press **Alt+Up Arrow** or **Alt+Down Arrow**.

## Add and edit lines

A section can contain five line types:

| Type | Use |
| --- | --- |
| Chord | A chord-only row, printed blue and bold. |
| Lyric | A lyric-only row. |
| Instruction | A stage direction or performance cue. |
| Chord + Lyric | Separate chord and lyric inputs rendered as two aligned rows. |
| Blank | Intentional vertical spacing in the chart. |

Use the buttons beneath a section to add a Chord, Lyric, Instruction, Chord + Lyric, or Blank row.

Line behavior:

- Press **Enter** in a chord, lyric, instruction, or chord-and-lyric lyric input to create another row of the same type immediately below it.
- Use the **B** control on Lyric or Chord + Lyric rows to bold the entire lyric.
- Wrap part of a lyric in `**double asterisks**` to toggle emphasis for only that text.
- Use the arrow controls to move a line within its section.
- Drag the line handle to reorder within or across sections.
- Focus the line handle and press **Alt+Up Arrow** or **Alt+Down Arrow** for a keyboard-accessible move, including across section boundaries.
- Delete is undoable through the chart's Undo command.

## Transpose a chart

Use the minus and plus buttons beside **Transpose** to move supported chords down or up one semitone.

Transposition applies to Chord rows and the chord field of Chord + Lyric rows. It does not alter lyrics, instructions, section labels, or arrangement notes. Common roots, accidentals, slash chords, extensions, suspended, diminished, and augmented forms are supported.

When **Original Key** is blank, the first transposition records the pre-transposition key there. You can also set or clear Original Key manually.

## Find and replace

Open Find with **Cmd/Ctrl+F** or Find & Replace with **Cmd/Ctrl+H**.

The inline bar searches chord, lyric, instruction, and combined-row text. Options include:

- case-sensitive matching;
- regular expressions;
- Replace All.

Invalid regular expressions display an error and do not change the chart. A successful Replace All is grouped into one Undo step. Press **Escape** or the close button to dismiss the bar.

## Undo and redo

Chart Creator retains up to 50 history entries.

- **Cmd/Ctrl+Z:** Undo.
- **Cmd/Ctrl+Shift+Z:** Redo.

Typing into one field is batched from focus to blur so ordinary text entry behaves as one history step. When an input is focused, the operating system's native text Undo remains available instead of being intercepted as chart Undo.

Library deletion, group deletion, and collected-section deletion affect separate storage collections and are not restored by chart Undo.

## Save and organize the library

Select **Save to Library** or press **Cmd/Ctrl+S**. Saving creates or updates the library entry with the same chart ID.

Saving to the library is different from exporting JSON:

- **Save to Library** updates local application storage and, when configured, the desktop mirror folder.
- **Export JSON** downloads or saves a portable file containing the current chart.

### Groups

Use the **+** button beside Groups in the Library workspace to create a group. Groups can represent setlists, folders, bands, or any other local organization.

- Assign a chart from its Library card or from the chart's Info tab.
- Rename a group from its group row.
- Move every assigned chart before deleting a group.

### Favorites

Toggle a chart's favorite control from the compact library or full Library workspace. Favorite status belongs to the library entry and is preserved when that chart is saved again.

### Loading a chart

Select **Open** on a library chart. If the current chart differs from its last library save, Chart Creator asks for confirmation before replacing it. The loaded chart becomes the current autosaved draft.

## Save and restore versions

Versions are manual snapshots stored inside a saved chart's library entry.

1. Save the chart to the library at least once.
2. Open the **Versions** tab.
3. Select **Save Version**.
4. Enter a name and optional notes.

Restoring a version replaces the current chart content while retaining the parent chart's identity and version history. Confirm the warning when the current chart has unsaved changes. Save the restored result to the library if it should become the main version.

Versions are local library data. They are not included when **Export JSON** exports the current chart state.

## Use private Info fields

The **Info** tab contains Group, Status, Source, and Info notes. These are workflow fields:

- They remain in the current chart, library save, and JSON export.
- They do not appear in the live preview or PDF.

“Private” describes output visibility, not encryption. Anyone with access to an exported JSON file or the local storage profile can read them.

## Collect and reuse sections

Select the collect action on a section, give the copy a name, and open the **Collected** tab.

Collected sections are stored separately from their source charts. Inserting one creates fresh identifiers, so editing the inserted section does not change the collected copy or original source. Deleting a collected item requires confirmation and does not delete any section already inserted into a chart.

## Import text

Select **Import Text**, paste the chart, and choose **Import**. Imported sections are appended to the current chart.

Parsing rules:

- `[Intro]`, `[Chorus]`, `[Bridge]`, `[Outro]`, and `[Instrumental]` create matching sections.
- A numeric heading such as `[2]` creates Verse 2.
- Any other bracketed heading creates a Custom section.
- A repeat suffix such as `[Chorus] x2` sets the section repeat count.
- A chord-only line beginning with A–G and containing supported chord tokens is detected as chords.
- A chord line followed by a lyric line becomes a Chord + Lyric row.
- Parenthesized lines and lines beginning with `Capo`, `Key:`, or `BPM` become instructions.
- Other non-empty lines become lyrics.
- Blank input is rejected; blank lines in pasted text are not imported as Blank rows.

Review imported content before saving because chord detection is intentionally heuristic.

## Import and export JSON

### Export

Select **Export JSON**. The file contains the normalized current chart, including public chart fields and private Info fields. It does not contain the full library, groups catalog, collected-section catalog, favorites, or the chart's saved-version history.

### Import

Select **Load Chart from JSON** and choose a Chart Creator JSON file. The imported state replaces the current chart after validation and normalization. Export a backup before importing over important unsaved work.

JSON is the recommended transfer format between browser mode, desktop mode, devices, or storage profiles.

## Export PDF

Select **Export PDF** or press **Cmd/Ctrl+E**. The PDF includes chart-facing content but excludes workflow-only Info fields and editor state.

The live preview is a close guide, not a pixel-identical PDF renderer. See [PDF Output Reference](PDF_OUTPUT.md) for typography, pagination, file naming, and known limitations.

## Configure a desktop mirror folder

Mirror folders are available only in the Tauri desktop application.

1. Open **Settings**.
2. Select **Choose** beside Saved songs folder.
3. Select a directory you control.
4. Save a chart to the library.

Each library save also writes the current chart as an ID-based JSON file. Renaming a chart updates the same file because the filename is based on chart identity, not title.

Important limits:

- Autosave does not write the mirror; **Save to Library** does.
- Clearing the folder setting stops future mirror writes but does not delete existing files.
- Deleting a local library chart does not delete its mirror file.
- If the mirror write fails, the local library save can still succeed and the application reports the folder failure separately.

## Keyboard reference

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+Z` | Undo chart change |
| `Cmd/Ctrl+Shift+Z` | Redo chart change |
| `Cmd/Ctrl+F` | Open Find |
| `Cmd/Ctrl+H` | Open Find & Replace |
| `Cmd/Ctrl+S` | Save to Library |
| `Cmd/Ctrl+E` | Export PDF |
| `?` | Open the shortcut dialog when focus is not in a text field |
| `Escape` | Close the top dialog or the Find bar |
| `Alt+Up/Down Arrow` | Reorder the focused section or line handle |

Editor tabs follow standard tab behavior: use Tab to enter the tab list and arrow keys to change the active tab.

## Troubleshooting

### A chart disappeared after clearing browser data

Chart Creator cannot recover cleared `localStorage`. Import the most recent JSON backup or a JSON file from the configured desktop mirror folder.

### The library says storage is full

Export important charts as JSON, then delete older library entries. A failed library save is atomic: the new or updated entry is not partially written. The current draft's autosave can also fail near the storage limit, so make a JSON backup before continuing.

### A mirror-folder save failed

Confirm the folder still exists and is writable, then select it again in Settings if needed. The application may have saved the chart locally even though the mirror write failed; check the toast message.

### The preview and PDF do not match exactly

The preview uses browser layout and estimates page breaks. The PDF uses jsPDF font measurements and explicit page budgeting. Treat the exported PDF as the final print output.

### An imported text line received the wrong type

Change the line type manually after import. Use explicit bracketed section labels and keep chord-only lines free of prose to improve detection.
