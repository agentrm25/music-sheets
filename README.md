<img src="icon.png" width="128" height="128" alt="Chart Creator icon">

# Chart Creator

Chart Creator is a local-first desktop application for building color-coded music charts, organizing a personal chart library, and exporting charts as JSON or print-ready PDFs. The interface is written in vanilla HTML, CSS, and JavaScript and packaged with Tauri 2.

> **Release status:** Chart Creator is pre-release software. The published installers are unsigned, and the data format or behavior may change between releases. Back up important charts with **Export JSON**.

## What Chart Creator does

- Builds charts from sections containing chords, lyrics, instructions, combined chord-and-lyric rows, and blank spacing rows.
- Transposes supported chord symbols while leaving lyrics and instructions unchanged.
- Provides section templates, pointer and keyboard reordering, per-section text scaling, search and replace, and undo/redo.
- Maintains a local chart library with groups, favorites, versions, private workflow fields, and reusable collected sections.
- Imports chart text or Chart Creator JSON and exports the current chart as JSON or a US Letter PDF.
- Optionally mirrors library saves to a user-selected folder when running as the desktop application.

## Install a published build

Open the [Chart Creator releases page](https://github.com/agentrm25/music-sheets/releases). The current public release is a pre-release.

### macOS

Choose the disk image that matches your Mac:

- Apple Silicon (M-series): `chart-creator_0.5.0_aarch64.dmg`
- Intel: `chart-creator_0.5.0_x64.dmg`

Open the disk image and drag Chart Creator to **Applications**. On first launch, Control-click the application, choose **Open**, and confirm the unsigned-app warning. Matching `.app.tar.gz` archives are also available.

### Windows

The current release provides 64-bit Windows installers:

1. Download either `chart-creator_0.5.0_x64-setup.exe` or `chart-creator_0.5.0_x64_en-US.msi`.
2. Run the downloaded installer.
3. If Microsoft Defender SmartScreen appears, review the publisher warning, choose **More info**, and select **Run anyway** only if the file came from this repository's release page.

## Start using the application

1. Enter the song title, artist, musical key, tempo, meter, capo, and optional arrangement notes in the left panel.
2. Choose a section template and add it at the top or bottom of the chart.
3. Select each section and line type, then enter chords, lyrics, instructions, or combined chord-and-lyric content.
4. Check the live preview and adjust the section's **Text** percentage when a section needs larger output.
5. Select **Save to Library** to keep the chart in this browser or desktop application's local storage.
6. Select **Export JSON** for a portable backup and **Export PDF** for a printable chart.

The complete workflow, including imports, groups, versions, collected sections, keyboard controls, and recovery steps, is in the [User Guide](docs/USER_GUIDE.md).

## Data safety at a glance

- Chart data is stored in the current browser or desktop webview's `localStorage`; it is not synchronized to an account or server.
- Browser mode and the installed desktop application use different storage origins and therefore do not share a library automatically.
- Clearing site/application data can permanently remove the draft, library, groups, versions, collected sections, and settings.
- **Export JSON** is the portable backup mechanism. Private Info fields are included in JSON exports but excluded from PDFs.
- Deleting a library chart does not delete a JSON file previously written to a desktop mirror folder.

Read [Data, Backups, and Privacy](docs/DATA_AND_PRIVACY.md) before relying on the application for an important library.

## Run from source

### Prerequisites

- Node.js 24 or newer
- Rust 1.77.2 or newer
- The platform prerequisites required by Tauri 2

### Browser mode

```bash
git clone https://github.com/agentrm25/music-sheets.git
cd music-sheets
node build.js
npx --yes http-server@14.1.1 dist -p 1420
```

Open [http://localhost:1420](http://localhost:1420). Browser mode supports editing, local library storage, JSON import/export, and PDF export. Selecting a desktop mirror folder is available only in the Tauri application.

### Desktop development mode

```bash
git clone https://github.com/agentrm25/music-sheets.git
cd music-sheets
npm exec --yes --package=@tauri-apps/cli@2.11.4 -- tauri dev
```

### Build and test

```bash
npm exec --yes --package=@tauri-apps/cli@2.11.4 -- tauri build
node --test --test-concurrency=1 tests/*.test.js
cargo test --manifest-path src-tauri/Cargo.toml
```

Packaged applications are written under `src-tauri/target/release/bundle/`. See the [Development Guide](docs/DEVELOPMENT.md) for architecture, generated files, isolated QA, and release details.

## Documentation

- [User Guide](docs/USER_GUIDE.md) — create, edit, organize, import, export, and recover charts.
- [Data, Backups, and Privacy](docs/DATA_AND_PRIVACY.md) — storage boundaries, backup behavior, mirror files, and privacy implications.
- [PDF Output Reference](docs/PDF_OUTPUT.md) — public output contract, typography, pagination, and known limitations.
- [Development Guide](docs/DEVELOPMENT.md) — setup, project structure, testing, QA isolation, and releases.
- [Contributing](CONTRIBUTING.md) — change workflow and public-documentation rules.

## Technology

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri 2 and Rust |
| Interface | Vanilla HTML, CSS, and JavaScript |
| PDF generation | Bundled jsPDF 4.2.1 |
| Primary storage | Origin-specific `localStorage` |
| Automated checks | Node's built-in test runner and Cargo |

## Security

The application has no account system or hosted synchronization service. Its bundled Content Security Policy restricts scripts and network connections to the application itself, and the PDF library is stored in the repository rather than downloaded at runtime. Do not include private chart content, filesystem paths, credentials, or personal data in public bug reports.

## License

This repository does not currently contain a license. Public access to the source does not grant permission to copy, modify, or redistribute it.
