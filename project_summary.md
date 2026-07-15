# Chart Creator — Project Summary

This document records Chart Creator's current architecture, implemented workflows, output rules, and native build model. See [README.md](README.md) for installation and day-to-day development commands, and [production-scale-qa-2026-07-14.md](production-scale-qa-2026-07-14.md) for the production-scale report dated July 14, 2026 and completed July 15.

---

## 📁 File Structure

The repository uses a vanilla HTML/CSS/JavaScript frontend split into browser modules and bundled into a Tauri desktop shell.

| File / Path | Type | Description |
|:---|:---|:---|
| 📄 **[index.html](index.html)** | Source Code | Editor and library workspaces, four editor tabs, dialogs, toolbar, and script order. |
| 🎨 **[style.css](style.css)** | Source Code | Application themes, responsive layouts, accessible focus states, and print-preview styles. |
| ⚙️ **[app.js](app.js)** | Source Code | Startup, event binding, shortcuts, undo/redo wiring, and top-level chart actions. |
| 🧩 **[src-js/](src-js/)** | Source Code | State, storage, workflow, editor, preview, import/export, transpose, undo, and UI modules. |
| 📦 **[build.js](build.js)** | Build Script | Rebuilds `dist/` from production browser assets. |
| 🖨️ **[jspdf.umd.min.js](jspdf.umd.min.js)** | Vendored Dependency | Bundled jsPDF 4.2.1 UMD build used for offline PDF export. |
| 🧪 **[tests/](tests/)** | Test Suite | Node regression, contract, normalization, undo, PDF, and QA-isolation tests. |
| 🔬 **[qa/](qa/)** / **[script/](script/)** | QA Support | Synthetic native corpus, evidence, and isolated macOS QA build/run helpers. |
| 🚀 **[src-tauri/](src-tauri/)** | Tauri App | Rust commands, production and QA configurations, capabilities, icons, and packaging metadata. |
| 🔐 **[.github/workflows/release.yml](.github/workflows/release.yml)** | Release Workflow | Tag-triggered macOS/Windows draft release build with actions pinned to commit SHAs. |

---

## 💎 Core Features

### 1. Three-Panel Dashboard
* **Sidebar (Left)**: Edits chart metadata, transposition, arrangement notes, and a compact saved-chart list.
* **Editor (Center)**: Provides Sections, Versions, Info, and Collected tabs. Section and line controls support pointer and keyboard reordering.
* **Chart Preview (Right)**: Renders print-oriented chart output with line fitting, page-break guides, and native CSS zoom.
* **Library Workspace**: Adds full-card browsing, search, four sort modes, favorites, and group filters outside the three-panel editor.

### 2. Smart Transposition Engine
* Transposes entire songs up or down by semitones.
* Intelligently parses complex chords, including extensions, slash chords (`G/F#`), sus chords, and minor/major indicators.
* Follows standard spelling logic (e.g., automatically using flats for flat scales like `F`, `Bb`, `Eb`).

### 3. Text Import Parser
* Parses raw text chords and lyrics.
* Automatically detects lines containing chord symbols and formats them as Chord lines.
* Detects bracketed labels (e.g., `[Chorus]`) and creates distinct sections.
* Assigns regular lines as lyrics, treats common metadata-like lines as instructions, and merges adjacent chord/lyric pairs into grid lines.

### 4. Auto-Scale Line Fitting
* Measures rendered chord, lyric, grid, and instruction lines against the chart-paper width.
* Shrinks only overflowing lines, with a 60% floor; PDF export applies the same bound through jsPDF measurements.

### 5. Undo / Redo
* Full state rollback through `UndoManager` with a 50-entry deep-clone stack.
* `Cmd/Ctrl+Z` undoes and `Cmd/Ctrl+Shift+Z` redoes; toolbar buttons mirror availability.
* Text inputs batch edits via focus/blur: typing a chord progression counts as one undo step.

### 6. Section Templates
* Six presets: Empty, Verse 4-bar, Chorus 8-bar, Bridge 4-bar, Intro/Outro chords-only, and Instrumental 8-bar chords.

### 7. Line Drag-and-Drop & Search/Replace
* Drag handles on each line for reordering within and between sections.
* Inline find/replace supports literal or regular-expression matching, case sensitivity, safe preview highlighting, actual occurrence counts, and one-step Undo.

### 8. Local Library Workflows
* Saves charts to `localStorage` with deterministic legacy identity normalization and no read-time storage writes.
* Supports groups, favorites, search/sort, manual versions, collected reusable sections, and private Info fields.
* Versions are created and restored from the Versions tab; sections are collected from section actions and inserted or deleted from the Collected tab.
* The desktop app can optionally mirror saved charts into a selected folder using chart-ID-based filenames.
* Mirror files update on library Save, are not deleted with local-library entries, and contain current chart data rather than versions or collected catalogs.
* Export JSON contains current chart state, including Info fields; clearing origin data removes local drafts, library records, workflow collections, and settings.
* Save to Library, Export JSON, and Export PDF are distinct commands.

---

## 🎨 Design & Formatting Rules

The preview and PDF exporter share the following core sizing and color rules; intentional implementation differences are called out explicitly.

### Typography (Helvetica/Arial)
* **Font Family**: `'Helvetica Neue', Helvetica, Arial, sans-serif` for all previewed chart elements.
* **Lyric Font Size**: `17.6px`; **Chord Font Size**: `16px`; **Instruction Font Size**: `15.5px`.
* **Bold Lyric Lines**: Must be rendered at the same size as regular lyrics (`17.6px`) but with `font-weight: 700`.
* **Section Headers**: `17.5px`, bold (`700`), and formatted in **ALL CAPS** with no surrounding brackets.

### Color-Coding System
The preview and PDF sheets use the following application palette:

| Element | Hex Color | Notes |
|:---|:---|:---|
| **Chords** | `#1a55d4` | Blue, bold text |
| **Intro** | `#cc00cc` | Magenta, bold text |
| **Outro** | `#6b6b6b` | Gray, bold text |
| **Chorus Label** | `#217a14` | Green, bold text |
| **Bridge Label** | `#6a1f9a` | Dark Purple, bold text |
| **Instrumental Label** | `#1a55d4` | Blue, bold text |
| **Custom Label** | `#9b5c00` | Amber / Brown, bold text |
| **Instructions** | Preview `#ff12ff`; PDF `#cc00cc` | Magenta; italic in PDF |
| **Verse Numbers** | See below | Placed in brackets at the beginning of the first line of a verse |
| └ *Verse 1* | `#cc1800` | Red `[1]` |
| └ *Verse 2* | `#ff7a00` | Orange `[2]` |
| └ *Verse 3* | `#8a2be2` | Purple `[3]` |
| └ *Verse 4* | `#0070c0` | Blue `[4]` |
| └ *Verse 5* | `#00b050` | Green `[5]` |
| └ *Verse 6+* | `#6b6b6b` | Dark Gray `[6+]` |

### PDF Margin & Page Layout Rules
* **Page Size**: Standard Letter size.
* **Margins**: `40pt` left/right and `24pt` top; the final `20pt` is reserved for the footer.
* **Footer Page Numbers**: Rendered in the bottom-right corner as `Page X of Y` in small gray text.
* **Page Budgeting**: Sections and lines start a new page before crossing the reserved footer boundary.

---

## 🛠️ Resolved Engineering Hurdles

1. **Fixed PDF Export Crash**: Removed runtime CDN loading and bundled jsPDF locally, with guarded library initialization so export errors surface cleanly.
2. **Fixed Preview Cutoff**: Swapped CSS transforms for native CSS `zoom` so the scrolling wrapper calculates its layout dimensions correctly.
3. **Fixed Sections Pane Scroll & Card Resizing**:
   * Removed `max-height` limits on section editor cards to prevent nested scrolling (mouse wheel traps).
   * Restricted CSS transitions on `.section-card` to skip dimensions, preventing transition lag when dragging the resize handles.
   * Debounced `autoSave()` by `500ms` to stop heavy, blocking localStorage IO calls from interrupting smooth mouse resize gestures.
4. **Preserved Editor Text Selection**: Fine-tuned CSS drag handles so that dragging reorders cards, but users can still double-click and drag-select text inside the editor text fields without interference.
5. **Implemented Auto-Scale Line Fitting**: Added a post-render measurement pass that temporarily sets each content line to nowrap, measures scrollWidth against the available paper width, and applies a proportional font-size reduction when the line overflows. The scale floors at 0.6x to preserve legibility, and the original white-space is restored afterward so only overflowing lines are affected.
6. **Implemented Workflow Enhancements**: Added undo/redo, collapsible and resizable sections, six templates, duplicate-with-focus, pointer/keyboard reordering, find/replace, groups, versions, collected sections, private Info, and the full Library workspace.
7. **Resolved Code Review Issues (May 2026)**:
   * **Improved Transposition Regex**: Resolved a bug in the transposition regex to support complex jazz and pop chord voicings (e.g. `maj7`, `m7b5`, `7#9`, `sus2`/`sus4`, `dim7`).
   * **ID-Based Storage Indexing**: Migrated stored chart deduplication from title name to a generated unique ID to prevent naming collisions.
   * **Robust Storage Quota Handling**: Caught `QuotaExceededError` in local storage autosaves/library saves, informing the user when storage is full.
   * **Unicode Validation & UTF-8 Exports**: Warns when imported text contains the replacement character `\uFFFD` and exports JSON with `charset=utf-8`.
   * **Batched Text Undo/Redo**: Hooks text-edit batching into `UndoManager` through focus/blur event handlers.
   * **Centralized Modal Styles**: Cleaned up inline CSS for the text import modal and moved layout properties to `style.css`.
   * **PDF Verse Colors**: Aligned the PDF export colors with the CSS stylesheet rules for verses 4 and 5.

8. **Security Hardening (May 2026)**:
   * **XSS Fix**: Replaced `innerHTML` toast rendering with safe `textContent`-based DOM construction to prevent script injection via user-supplied chart titles and filenames.
   * **Bundled PDF Library**: Downloaded the official `jsPDF 4.2.1` UMD artifact from npm and bundled it locally, removing runtime dependency on public CDNs for PDF export.
   * **Removed Unused Capture Library**: Removed the unused vendored `html2canvas.min.js` file and script load, reducing the JavaScript supply-chain surface.
   * **Tightened CSP**: Stripped all external CDN domains (`cdnjs.cloudflare.com`, `jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`) from the Content Security Policy. Scripts now load only from `'self'`.
   * **Pinned Release Actions**: Pinned GitHub Actions `uses:` entries to full commit SHAs so release builds do not follow mutable tags or branches.



---

## 🚀 Native Build and QA Modes

* **Production**: `tauri.conf.json` builds browser assets into `dist/`, uses bundle ID `com.chartcreator.music`, and packages into `src-tauri/target/release/bundle/`.
* **Isolated QA (macOS)**: `tauri.qa.conf.json` builds into `dist-qa/` and `src-tauri/target/qa-approval-b/`, uses bundle ID `com.chartcreator.music.qa`, and seeds only that QA origin.
* **QA runner**: `./script/build_and_run.sh --verify` builds and launches the QA app; `--reset` clears only the hard-gated QA WebKit store before launch.
* **Release workflow**: Tags matching `v*` create draft macOS Intel, macOS Apple Silicon, and Windows releases.

---

## ✅ Implemented Workflows

The current application includes the following editor, output, library, and accessibility workflows:

| Feature | Implementation |
|:---|:---|
| **Undo / Redo** | `UndoManager` class with 50-entry stack, `Cmd+Z` / `Cmd+Shift+Z`, toolbar buttons, text-edit batching on focus/blur |
| **Collapsible Sections** | Chevron toggle in section header, collapses card body, `section.collapsed` persisted |
| **Section Templates** | `<select>` dropdown near Add Section with six presets (Empty, Verse 4-bar, Chorus 8-bar, Bridge 4-bar, Intro/Outro chords-only, Instrumental 8-bar) |
| **Duplicate + Edit Flow** | Duplicated sections flash highlight, auto-increment verse numbers, scroll + focus first input |
| **Line Drag-and-Drop** | Drag handles on each line, within-section and cross-section reordering via HTML5 drag API |
| **Search & Replace** | Inline bar (`Cmd/Ctrl+F` or `Cmd/Ctrl+H`) with case-sensitive and regex toggles across all line content |
| **Page Break Indicators** | Zoom-independent visual break lines overlaid in preview at 792pt equivalents (Letter page height) |
| **Shortcut Cheat Sheet** | Keyboard shortcut helper modal toggled via toolbar button or `?` hotkey |
| **Time Signature Selector** | `Time Sig` metadata field in sidebar, displaying in the preview/PDF next to BPM (hidden when unset) |
| **Arrangement Notes Field** | Free-text notes area in sidebar rendered under metadata with text-wrapping on preview/PDF |
| **Persistent Theme** | Stores light/dark application theme in settings while chart paper remains print-oriented |
| **Improved Saved Charts** | Compact and full library views with search, four sorts, favorites, groups, and stable legacy identities |
| **Versions and Collected Sections** | Manual chart snapshots plus reusable section copies with regenerated IDs on insert |
| **Private Info** | Group, status, source, and info notes persist without entering preview/PDF output |
| **Destructive Actions** | Library and collected-item deletions confirm; section changes remain available to chart Undo |
| **Offline PDF Export** | Bundled jsPDF export with no runtime CDN dependency |

### Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Shift+Z` | Redo |
| `Cmd/Ctrl+H` | Open search & replace |
| `Cmd/Ctrl+F` | Open find |
| `Cmd/Ctrl+S` | Save to library |
| `Cmd/Ctrl+E` | Export PDF |
| `?` | Open keyboard shortcuts cheat sheet |

## 🔮 Future Roadmap & Extensibility

The following items are ideas, not committed delivery plans:
* **Combined Setlist Export**: Reorder grouped songs and export a multi-song PDF.
* **Nashville Number System**: Convert chords dynamically relative to the key.
* **Chord Diagram Popovers**: Guitar/ukulele fingerings on hovering chords.
* **Live Sync**: Multi-user real-time editing and shareable view links.
* **Auto-Scroll Teleprompter**: Hands-free scrolling synced with song BPM.
* **Audio Reference**: Embed YouTube/Spotify links inside the editor.
* **Collapsible Workspace Panels**: Hide sidebar/preview for a focused editor view.
* **Command Palette (`Cmd+K`)**: Keyboard-driven command search bar.
* **Onboarding Walkthrough**: Step-by-step tour for first-time users.
* **Status Bar Counters**: Line counts, page estimations, and zoom indicators.
* **Section Minimap**: Color-coded structural navigator strip.
* **Per-Line Font Size Override**: Allow manual adjustment of individual line font sizes in the editor, overriding the auto-scale behavior for lines that need specific sizing.
* **Per-Syllable Chord Alignment**: Position individual chord tokens above corresponding lyric syllables instead of using the current row-based grid.
