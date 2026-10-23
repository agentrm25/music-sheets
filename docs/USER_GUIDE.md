# Chart Creator User Guide

This guide covers the installed desktop application and browser mode. Both interfaces work the same way unless a section explicitly calls out desktop-only behavior.

## Before you begin

Chart Creator is local-first. It does not create an online account or synchronize a library between devices. The current draft and saved library belong to the browser or desktop webview in which they were created.

For any chart you cannot afford to lose, save it to the library and export a JSON backup. See [Data, Backups, and Privacy](DATA_AND_PRIVACY.md) for the exact storage boundaries.

## Workspace overview

The toolbar's **Editor | Library** switch moves between the two workspaces. The commands on the right follow the workspace you are in.

### Editor workspace

The Editor has two panels:

1. **Edit** holds the chart. The **chart header** at the top is laid out like the printed header: title, artist, key with the transpose buttons, BPM, time signature, and capo. **Notes, original key & private info** below it opens the arrangement notes, the original key, and the private workflow fields. While it is closed, the hint next to it lists what's filled in. The sections follow the header.
2. **Preview** shows the chart's print-oriented appearance, page-break estimates, and zoom controls (25%–200%). It fits its panel automatically; use **Fit** to return to automatic fitting after a manual zoom.

Toolbar commands in the Editor:

- **Undo** and **Redo** (icon buttons).
- **Export PDF**.
- **Save to Library**. The arrow beside it has **Save version…**, **Version history**, and **Export JSON backup**.
- **More** has **New chart**, **Import…**, **Keyboard shortcuts**, and **Settings**.

Below about 1100 pixels wide, an **Edit | Preview** switch shows one panel at a time. On narrow windows, Undo, Redo, and More show as icons, and Export PDF moves into **More** on the smallest screens.

### Library workspace

The Library provides larger cards for saved charts. Use it to:

- search titles and metadata;
- sort by newest, title, key, or group;
- filter by group, or choose **Favorites** to see starred charts;
- mark favorites with the star;
- open a chart by clicking its card or title (the chart you're editing is marked **Open now**);
- move a chart to another group or delete it from the card's **⋯** menu;
- start a chart with **New chart** in the toolbar.

Deleting a chart from the library is permanent for local storage and requires confirmation. It does not remove a JSON mirror file previously written by the desktop application.

## Create a chart

Select **More → New chart** (or **New chart** in the Library). If the current chart has changes that aren't saved to Library, Chart Creator asks first, because starting a new chart also clears Undo history.

A new chart starts empty, with the cursor in the title. Select **Add chords & lyrics** to create a verse with a paired row, or **Import existing text**. Fill in the chart header as needed:

| Field | Behavior |
| --- | --- |
| Title | Used in the library and as the base export filename. An empty title becomes “Untitled Chart” in the library and `chart` for exports. |
| Artist | Appears in the preview, PDF, and JSON. |
| Key | Current performance key. Transposition changes this field. |
| BPM | Whole number from 20 through 300. |
| Time | Optional time signature shown with BPM. |
| Capo | Optional capo position. |
| Original key | In **Notes, original key & private info**. Optional reference key, printed as “originally in …”. If blank, the first transposition records the current key here. |
| Arrangement notes | In **Notes, original key & private info**. Public chart instructions shown in the preview and PDF. |

Changes update the preview immediately. Your work is autosaved on this device as you go, so a crash or accidental close never loses it. The status bar shows one save status:

- **Not in Library yet**: this chart has never been saved to the Library.
- **Unsaved changes**: the Library copy is older than what you see.
- **Saved to Library**: the Library copy matches.

If the on-device autosave ever fails (for example, when storage is full), the status bar also shows **Draft save failed**. Select **Save to Library** (Cmd/Ctrl+S) whenever you want the Library copy updated. Collapsing or resizing sections doesn't count as a change.

## Add and configure sections

Open **Add section** in the editor toolbar, or the **Add section** button after the last section. The menu has:

- **Templates:**
  - **Blank verse:** one chord row and one lyric row.
  - **Verse – 4 bar:** four chord-and-lyric rows.
  - **Chorus – 8 bar:** eight chord-and-lyric rows.
  - **Bridge – 4 bar:** four chord-and-lyric rows.
  - **Intro / Outro – chords only:** four chord rows.
  - **Instrumental – 8 bar chords:** eight chord rows.
- **My sections:** sections you saved for reuse (see [Reuse sections](#reuse-sections)).
- **From pasted text…:** opens Import.

The toolbar menu adds the new section **after the section you're working on**. The menu says where (“Adds after VERSE 1”), and **Add at the top instead** puts it first. The button after the last section always adds at the end. The new section scrolls into view with the cursor in its first line.

Each section header shows its collapse arrow, drag handle, **section type**, and the **verse number** (verses) or **label** (Custom sections). Non-default print settings show as badges, such as **×2** or **Text 130%**. A collapsed section shows its first line in the header so you can tell sections apart.

The section's **⋯** menu has:

- **Text size:** scales that section's preview and PDF typography from 100% through 200% in 10% steps.
- **Repeat:** a repeat count from 1 to 99, printed with the section heading (for example “CHORUS × 2”). Verses print “× 2” above the verse.
- **Duplicate:** copies the section with new internal identifiers.
- **Save to My sections:** stores a reusable copy.
- **Delete:** removes the section. The confirmation toast has an **Undo** button, and chart Undo works too.

Other section controls:

- **Collapse/expand** hides or shows the editing body without removing content. Collapsing is not an Undo step.
- **Resize** (the corner of the section body) changes the section editor's height in the editor only, not the output.
- **Reorder** by dragging the section handle. Keyboard users can focus the handle and press **Alt+Up Arrow** or **Alt+Down Arrow**. Verse sections are renumbered to follow chart order after reordering.

## Add and edit lines

A section can contain five line types:

| Type | Use |
| --- | --- |
| Chord | A chord-only row, printed blue and bold. |
| Lyric | A lyric-only row. |
| Instruction | A stage direction or performance cue. |
| Chord + Lyric | Separate chord and lyric inputs rendered as two aligned rows. |
| Blank | Intentional vertical spacing in the chart. |

Each section ends with one add-line button. It adds another line of the **same type as the section's last line** (for example **+ Chord + Lyric line**). The arrow beside it lists every type. Each line's type menu changes an existing line's type.

In **Chord + Lyric** rows, use spaces to place chords above lyric characters. Both inputs use the same fixed-width font and scroll together. Preview and PDF preserve those columns, including verse-number offsets, and wrap long pairs together. Inline `**bold**` markers are formatting syntax and do not occupy columns in the output.

Line behavior:

- Press **Enter** in a chord, lyric, instruction, or chord-and-lyric lyric input to create another row of the same type immediately below it.
- Hover over or focus a line to show its tools: **B** (bold the whole lyric, on Lyric and Chord + Lyric rows), move up, move down, and delete. Bold stays visible while it is on.
- Wrap part of a lyric in `**double asterisks**` to toggle emphasis for only that text.
- Drag the line handle to reorder within or across sections.
- Focus the line handle and press **Alt+Up Arrow** or **Alt+Down Arrow** for a keyboard-accessible move, including across section boundaries.
- Delete is undoable through the chart's Undo command.

## Transpose a chart

Use the **−** and **+** buttons beside **Key** to move supported chords down or up one semitone. The Key field follows along, including minor keys (Am becomes Bbm), and always uses one of the spellings the Key menu offers.

Once a chart has an original key, the header shows how far you've moved from it (for example **+3 from G**). Select **Back to original key** to undo the whole transposition in one step. Each transposition's toast also has an **Undo** button.

Transposition applies to Chord rows and the chord field of Chord + Lyric rows. It does not alter lyrics, instructions, section labels, or arrangement notes. Common roots, accidentals, slash chords, extensions, suspended, diminished, and augmented forms are supported.

When **Original key** is blank, the first transposition records the pre-transposition key there. You can also set or clear it under **Notes, original key & private info**.

## Find and replace

Select **Find** in the editor toolbar, or press **Cmd/Ctrl+F**. **Cmd/Ctrl+H** opens Find with Replace showing.

- The match count updates as you type. Matching fields are highlighted in the editor and the preview.
- Press **Enter** (or the down arrow) for the next match and **Shift+Enter** (or the up arrow) for the previous one. The current match scrolls into view, and a collapsed section opens to show it.
- **All text / Chords only / Lyrics only** limits where to search. Lyrics only includes instructions. Typing a chord name such as `Am` switches to **Chords only** until you pick a scope yourself.
- In **Chords only**, a plain search matches whole chords: `Am` matches `Am` and `Am/G` but not `Am7`, and never touches lyrics.
- **Aa** matches case, and **.\*** uses regular expressions.
- Select **Replace** to show the replacement field, then **Replace all**. Replace All is one Undo step, and its toast has an **Undo** button.

Invalid regular expressions show **Invalid pattern** and do not change the chart. Press **Escape** or the close button to dismiss the bar.

## Undo and redo

Chart Creator retains up to 50 history entries.

- **Cmd/Ctrl+Z:** Undo.
- **Cmd/Ctrl+Shift+Z:** Redo.

Typing into one field is batched from focus to blur so ordinary text entry behaves as one history step. When an input is focused, the operating system's native text Undo remains available instead of being intercepted as chart Undo.

Toasts for deleting a section, transposing, Replace All, importing, adding a saved section, and restoring a version include an **Undo** button. It is removed as soon as you make another change, so it only ever undoes the change it describes.

Collapsing and resizing sections are not history steps. Library deletion, group deletion, and saved-section deletion affect separate storage collections and are not restored by chart Undo.

## Save and organize the library

Select **Save to Library** or press **Cmd/Ctrl+S**. Saving creates or updates the library entry with the same chart ID.

Saving to the library is different from exporting JSON:

- **Save to Library** updates local application storage and, when configured, the desktop backup folder.
- **Export JSON backup** (the arrow beside Save to Library) downloads or saves a portable file containing the current chart.

### Groups

Use the **+** button beside Groups in the Library workspace to create a group. Groups can represent setlists, folders, bands, or any other local organization.

- Assign a chart from its Library card's **⋯** menu, or from **Group** under **Notes, original key & private info** in the chart header.
- Rename a group from its group row.
- Move every assigned chart before deleting a group; Chart Creator tells you how many charts are still in it.

### Favorites

Toggle a chart's star on its Library card. Choose **Favorites** in the group list to show only starred charts. Favorite status belongs to the library entry and is preserved when that chart is saved again.

### Opening a chart

Click a chart's card or title. If the current chart has work that differs from its last library save, Chart Creator asks for confirmation before replacing it; an empty new chart opens without asking. The loaded chart becomes the current autosaved draft.

## Save and restore versions

Versions are manual snapshots stored inside a saved chart's library entry.

1. Open the arrow beside **Save to Library** and choose **Save version…**. If the chart isn't in the Library yet, saving a version adds it.
2. Enter a name and optional notes, then press **Enter** or select **Save version**.
3. To see or restore versions, choose **Version history** from the same menu. It also has a **Save version** button.

Restoring a version replaces the current chart content while retaining the parent chart's identity and version history. Confirm the warning when the current chart has unsaved changes. The toast has an **Undo** button. Save the restored result to the library if it should become the main version.

Versions are local library data. They are not included when **Export JSON backup** exports the current chart state.

## Use private info fields

**Notes, original key & private info** in the chart header has a **Private — never printed or exported to PDF** group: Group, Status, Source, and Private notes. These are workflow fields:

- They remain in the current chart, library save, and JSON export.
- They do not appear in the live preview or PDF.

“Private” describes output visibility, not encryption. Anyone with access to an exported JSON file or the local storage profile can read them.

## Reuse sections

Open a section's **⋯** menu, choose **Save to My sections**, and give the copy a name. Saved sections appear under **My sections** in every **Add section** menu, with the chart they came from.

Saved sections are stored separately from their source charts. Adding one creates fresh identifiers, so editing the added section does not change the saved copy or the original source. The **×** beside a saved section deletes it after confirmation; this does not delete any section already added to a chart.

## Import

Select **More → Import…**, **Import existing text** on an empty chart, or **From pasted text…** in the Add section menu. You can also drop a `.txt` or `.json` file anywhere on the window.

### Pasted text

Paste the chart and select **Add sections**. The sections are added to the end of the current chart; the toast has an **Undo** button.

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

### JSON files

In the Import dialog, select **Open JSON file…** and choose a Chart Creator JSON file, or drop one on the window. The imported state replaces the current chart after validation and normalization, and Chart Creator asks first when the current chart has unsaved work. Export a backup before importing over important unsaved work.

JSON is the recommended transfer format between browser mode, desktop mode, devices, or storage profiles.

## Export

### JSON

Open the arrow beside **Save to Library** and choose **Export JSON backup**. The file contains the normalized current chart, including public chart fields and private info fields. It does not contain the full library, groups catalog, saved-section catalog, favorites, or the chart's saved-version history.

### PDF

Select **Export PDF** or press **Cmd/Ctrl+E**. The PDF includes chart-facing content but excludes private info fields and editor state.

The live preview is a close guide, not a pixel-identical PDF renderer. See [PDF Output Reference](PDF_OUTPUT.md) for typography, pagination, file naming, and known limitations.

## Settings

**More → Settings** has:

- **Appearance:** the **Light mode** switch.
- **Backup folder** (desktop app only): see below. Browser mode doesn't show this setting.

### Configure a desktop backup folder

The backup (mirror) folder is available only in the Tauri desktop application.

1. Open **Settings**.
2. Select **Choose** beside Backup folder.
3. Select a directory you control.
4. Save a chart to the library.

Each library save also writes the current chart as an ID-based JSON file. Renaming a chart updates the same file because the filename is based on chart identity, not title.

Important limits:

- Autosave does not write the folder; **Save to Library** does.
- Clearing the folder setting stops future writes but does not delete existing files.
- Deleting a local library chart does not delete its file in the folder.
- If the folder write fails, the local library save can still succeed. The status bar shows **Saved to Library · folder sync failed**, and Settings shows the error until the next successful folder save.

## Keyboard reference

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+Z` | Undo chart change |
| `Cmd/Ctrl+Shift+Z` | Redo chart change |
| `Cmd/Ctrl+F` | Open Find |
| `Cmd/Ctrl+H` | Open Find & Replace |
| `Enter` / `Shift+Enter` | Next / previous match (in the Find field) |
| `Cmd/Ctrl+S` | Save to Library |
| `Cmd/Ctrl+E` | Export PDF |
| `Enter` | Add a line below (in a line field) |
| `Alt+Up/Down Arrow` | Move the focused section or line handle |
| `Esc` | Close the open menu, dialog, or Find bar |
| `?` | Open the shortcut dialog when focus is not in a text field |

## Troubleshooting

### A chart disappeared after clearing browser data

Chart Creator cannot recover cleared `localStorage`. Import the most recent JSON backup or a JSON file from the configured desktop backup folder.

### The library says storage is full

Export important charts as JSON, then delete older library entries. A failed library save is atomic: the new or updated entry is not partially written. The on-device autosave can also fail near the storage limit (the status bar shows **Draft save failed**), so make a JSON backup before continuing.

### A backup-folder save failed

Confirm the folder still exists and is writable, then select it again in Settings if needed. The application may have saved the chart locally even though the folder write failed; check the toast message.

### The preview and PDF do not match exactly

The preview uses browser layout and estimates page breaks. The PDF uses jsPDF font measurements and explicit page budgeting. Treat the exported PDF as the final print output.

### An imported text line received the wrong type

Change the line type manually after import. Use explicit bracketed section labels and keep chord-only lines free of prose to improve detection.
