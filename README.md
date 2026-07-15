<img src="icon.png" width="128" height="128" alt="Chart Creator icon">

# Chart Creator

Create color-coded music charts, organize them in a local library, and export them as JSON or print-ready PDFs. Chart Creator uses vanilla HTML, CSS, and JavaScript inside a Tauri desktop shell.

## Installation

Download the latest installer from [GitHub Releases](https://github.com/agentrm25/music-sheets/releases).

### macOS

1. Check your Mac's chip: Click the Apple icon () in the top-left corner of your screen and select **About This Mac**. Look at **Processor** or **Chip**.
2. From the release assets, download the `.dmg` file matching your Mac:
   - **Apple Silicon (M1, M2, M3, M4, etc.)**: Download the file ending in `_aarch64.dmg`.
   - **Intel Processor**: Download the file ending in `_x64.dmg`.
3. Open the downloaded `.dmg` file and drag the **Chart Creator** icon into your **Applications** folder.
4. **First-time Launch Setup (Unsigned App warning)**:
   - Go to your Applications folder.
   - Hold the **Control** key and click the app icon, then choose **Open** from the menu.
   - Click **Open** in the warning box that appears. This is only needed for the very first launch.

### Windows

1. From the release assets, download the Windows `.msi` or setup `.exe` installer.
2. Double-click the downloaded file.
3. **First-time Launch Setup (Windows SmartScreen warning)**:
   - Since the app is unsigned, Windows may show a blue box saying *"Windows protected your PC"*.
   - Click **More info** (under the text), then click **Run anyway**.

## Interface

The three-panel workspace provides an intuitive chart-building experience:

1. **Song Details (left)**: Edit title, artist, key, original key, BPM, time signature, capo, arrangement notes, and the compact saved-chart list.
2. **Editor (center)**: Build sections and lines, or switch among the Sections, Versions, Info, and Collected tabs.
3. **Live Preview (right)**: Review print output with automatic line fitting, zoom controls, and page-break guides.

Use the toolbar workspace switch to move between the three-panel editor and the full library view.

## Features

- **Three-panel workspace** — sidebar for metadata, center for the section editor, right for live preview
- **Smart transposition** — transpose entire charts by semitones with automatic sharp/flat spelling and complex chord support (slash chords, extensions, sus, dim, aug)
- **Section editor** — drag-and-drop sections and lines, custom resize, collapsible cards, six presets (Empty, Verse, Chorus, Bridge, Intro/Outro, Instrumental), and repeat controls for non-verse sections
- **Color-coded output** — section types and chords use a consistent application palette with tuned sizes for chords, lyrics, instructions, and headers
- **PDF export** — page-budgeted Letter output with line fitting, page numbers, bracket-wrapped arrangement notes, and the same core sizing rules as the preview
- **Search and replace** — inline bar with regex and case-sensitive support across all chord, lyric, instruction, and chord + lyric content
- **Text import** — paste raw chart text and let the parser detect chord lines, section labels, and lyrics
- **Library manager** — search, sort, favorite, group, load, and delete charts stored in `localStorage`
- **Versions and collected sections** — save chart snapshots and reuse copied sections with fresh IDs
- **Private workflow info** — track group, status, source, and private notes that stay out of preview and PDF output
- **Desktop folder mirror** — optionally mirror saved charts as ID-stable JSON files from the Tauri app
- **JSON import/export** — open validated chart JSON and export current chart state separately from library Save
- **Undo/redo** — 50-entry stack with batched text-editing so typing feels natural
- **Persistent light/dark themes** — toggle the application theme while keeping chart output print-ready
- **Keyboard and accessibility support** — semantic dialogs and tabs, focus trapping, keyboard reordering, and documented shortcuts

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) (for the dev server)
- [Rust](https://rustup.rs) (for the Tauri desktop build)
- macOS or Windows for packaged desktop releases; browser mode works anywhere Node.js can run

### Run in a Browser (no Rust needed)

```bash
git clone https://github.com/agentrm25/music-sheets.git
cd music-sheets
node build.js
npx --yes http-server@14.1.1 dist -p 1420
```

Open [http://localhost:1420](http://localhost:1420).

### Run as a Desktop App

```bash
git clone https://github.com/agentrm25/music-sheets.git
cd music-sheets
npm exec --yes --package=@tauri-apps/cli@2.11.4 -- tauri dev
```

## Build

```bash
npm exec --yes --package=@tauri-apps/cli@2.11.4 -- tauri build
```

The packaged app lands in `src-tauri/target/release/bundle/`.

Linux is supported for browser development, but the tag-triggered release workflow currently publishes only macOS and Windows installers.

## Data and File Behavior

- The current draft, library, groups, collected sections, versions, and settings live in origin-specific `localStorage`. Clearing browser/app site data removes them.
- **Save to Library** updates the local library. In the desktop app, it also writes the current chart to the selected mirror folder when one is configured.
- **Export JSON** writes only the current chart state, including Info fields; library versions and the collected-section catalog are not included.
- Mirror files use chart-ID-based names, update on library Save, and are not removed when a chart is deleted from the local library.
- Folder-write failures do not undo a successful local-library Save; the app reports the mirror failure separately.

## Validation

```bash
node --test --test-concurrency=1 tests/*.test.js
cargo test --manifest-path src-tauri/Cargo.toml
```

On macOS, `./script/build_and_run.sh --verify` builds and launches an isolated QA app with bundle ID `com.chartcreator.music.qa`. Its generated frontend, Rust target, and WebKit data are separate from production. Use `--reset` only when you intentionally want to clear that QA-only WebKit store and reseed the synthetic corpus.

## Tech Stack

| Layer | Technology |
|:---|:---|
| Shell | Tauri 2 (Rust) |
| UI | Vanilla HTML/CSS/JS — no framework |
| PDF | jsPDF 4.2.1 (bundled locally) |
| Storage | `localStorage` |

## Project Structure

```
.
├── .github/workflows/
│   └── release.yml        # Pinned GitHub Actions release build
├── index.html              # Main HTML — three-panel layout, modals
├── app.js                  # App glue — event bindings and init
├── build.js                # Copies browser assets into dist/ for Tauri/dev server
├── style.css               # Editor (light/dark) and preview paper (print) styles
├── src-js/
│   ├── constants.js        # Section metadata, verse colors
│   ├── state.js            # State factory, ID generation, templates
│   ├── storage.js          # localStorage auto-save/load, library CRUD
│   ├── editor.js           # Section card builder, line items, drag-and-drop
│   ├── preview.js          # Chart paper renderer, auto-scale, zoom
│   ├── import-export.js    # JSON and PDF export, text import parser
│   ├── transpose.js        # Chord transposition engine
│   ├── undo.js             # UndoManager with text-edit batching
│   ├── ui.js               # Dialogs, toasts, status, find/replace
│   └── workflow.js         # Full library, groups, versions, info, collected sections
├── qa/                      # Synthetic data and native QA evidence
├── script/                  # Isolated QA build/run helpers
├── tests/                   # Node regression and contract tests
├── jspdf.umd.min.js        # Bundled PDF library
├── src-tauri/              # Tauri backend (Rust)
│   ├── Cargo.toml          # Rust dependencies
│   ├── capabilities/       # Tauri runtime permissions
│   ├── tauri.conf.json     # CSP, window config, build commands
│   ├── tauri.qa.conf.json  # Isolated native QA bundle/configuration
│   └── src/lib.rs          # Tauri app setup
└── icon.png                # App icon
```

## Security

The PDF dependency is bundled locally. The Content Security Policy restricts scripts to `'self'`, saved charts remain local unless a desktop mirror folder is selected, and release workflow actions are pinned to immutable commit SHAs.

## License

This repository does not currently include a license file.
