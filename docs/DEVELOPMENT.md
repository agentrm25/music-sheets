# Development Guide

This guide describes the public source tree, local development commands, test suites, isolated QA mode, and release workflow.

## Prerequisites

- Git
- Node.js 20 or newer
- Rust 1.77.2 or newer through `rustup`
- Platform build dependencies required by [Tauri 2](https://v2.tauri.app/start/prerequisites/)

There is no application `package.json`. Frontend source uses browser APIs directly, and the documented commands invoke pinned npm packages through `npx` or `npm exec`.

## Clone and inspect the baseline

```bash
git clone https://github.com/agentrm25/music-sheets.git
cd music-sheets
git status --short --branch
```

Start from a clean worktree. Generated `dist/`, `dist-qa/`, Rust targets, editor metadata, and local planning/review artifacts are intentionally excluded from version control.

## Run browser mode

Build the static asset directory:

```bash
node build.js
```

Serve it on the same origin used by the Tauri development configuration:

```bash
npx --yes http-server@14.1.1 dist -p 1420
```

Open [http://localhost:1420](http://localhost:1420).

`build.js` deletes and recreates `dist/`, then copies:

- `index.html`;
- `app.js`;
- `style.css`;
- `icon.png`;
- `src-js/`;
- `jspdf.umd.min.js`.

Do not edit `dist/` directly. Change source files and rerun `node build.js`.

Browser mode is the quickest way to exercise interface, local storage, import/export, and PDF behavior. Native folder selection and filesystem mirroring require the Tauri application.

## Run desktop development mode

```bash
npm exec --yes --package=@tauri-apps/cli@2.11.4 -- tauri dev
```

The production Tauri configuration:

- runs `node build.js` before serving or building;
- serves `dist/` on port 1420 during development;
- uses bundle identifier `com.chartcreator.music`;
- exposes only the Tauri commands registered in `src-tauri/src/lib.rs`;
- applies the Content Security Policy in `src-tauri/tauri.conf.json`.

The production application uses its own persistent webview storage. Do not use real chart data for destructive development tests.

## Build packages

```bash
npm exec --yes --package=@tauri-apps/cli@2.11.4 -- tauri build
```

Outputs are generated under:

```text
src-tauri/target/release/bundle/
```

Package formats depend on the host platform and installed platform prerequisites. The build does not sign or notarize artifacts automatically in local development.

## Run automated tests

Run the complete JavaScript regression and contract suite:

```bash
node --test --test-concurrency=1 tests/*.test.js
```

Run Rust and Rust documentation tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Useful focused checks:

```bash
node --test tests/state-normalization.test.js
node --test tests/pdf-font-consistency.test.js
node --check app.js
node --check src-js/editor.js
```

Use the full JavaScript command before integrating a change because some tests assert contracts across multiple source files and rely on serial execution.

## Isolated native QA on macOS

`script/build_and_run.sh` creates and launches a separate QA application. It is intentionally isolated from the production bundle:

- bundle identifier: `com.chartcreator.music.qa`;
- product name: `chart-creator-qa`;
- frontend output: `dist-qa/`;
- separate Rust target directory;
- QA-only synthetic seed script;
- separate WebKit storage origin.

Run the default QA build and application:

```bash
./script/build_and_run.sh
```

Available modes:

```bash
./script/build_and_run.sh --verify
./script/build_and_run.sh --debug
./script/build_and_run.sh --logs
./script/build_and_run.sh --telemetry
./script/build_and_run.sh --reset
```

`--reset` deletes only the WebKit data directory whose bundle ID exactly matches `com.chartcreator.music.qa`, then launches a freshly seeded QA profile. The script refuses unexpected identifiers or paths. Even with these guards, inspect the script before changing bundle IDs, target paths, or reset logic.

The QA helper is macOS-specific because it uses macOS application bundles, WebKit storage locations, `open`, `pgrep`, `PlistBuddy`, and optional `lldb`/unified logging.

Do not commit QA screenshots, replay logs, disposable paths, local performance captures, or approval notes. Keep durable behavior in automated tests and public documentation.

## Architecture

### Frontend entry points

| Path | Responsibility |
| --- | --- |
| `index.html` | Application shell, controls, tabs, dialogs, and script order |
| `style.css` | Application themes, responsive layout, editor styles, preview paper, focus states |
| `app.js` | Startup, form bindings, toolbar commands, shortcuts, workspace switching |
| `build.js` | Deterministic copy from source files to generated frontend output |

### Frontend modules

| Module | Responsibility |
| --- | --- |
| `src-js/constants.js` | Section metadata and chart colors |
| `src-js/state.js` | State factory, normalization, IDs, numeric bounds, templates |
| `src-js/storage.js` | Autosave, library, groups, versions, collected sections, settings, mirror writes |
| `src-js/editor.js` | Section cards, line editors, pointer/keyboard reorder, section text scale |
| `src-js/preview.js` | Live chart rendering, line fitting, zoom, page-break estimates |
| `src-js/import-export.js` | Text/JSON import, JSON export, PDF generation |
| `src-js/transpose.js` | Chord parsing and semitone transposition |
| `src-js/undo.js` | Bounded chart history and text-edit batching |
| `src-js/ui.js` | Dialog stack, toasts, library list, find/replace |
| `src-js/workflow.js` | Full Library, groups, versions, Info, collected-section UI |

Modules extend the shared `window.ChartApp` object and are loaded in the order declared near the end of `index.html`. When adding a module, update both the script order and `build.js` inputs if necessary.

### Native layer

| Path | Responsibility |
| --- | --- |
| `src-tauri/src/lib.rs` | Tauri setup, directory selection, guarded JSON file writes, logging |
| `src-tauri/src/main.rs` | Desktop binary entry point |
| `src-tauri/capabilities/default.json` | Tauri capability declaration |
| `src-tauri/tauri.conf.json` | Production product, build, window, CSP, and bundle configuration |
| `src-tauri/tauri.qa.conf.json` | Isolated QA overrides |
| `src-tauri/Cargo.toml` | Rust package metadata and dependencies |

## State and persistence contracts

The current chart state contains chart metadata plus an ordered section array. Each section owns an ordered line array. Chart, section, and line IDs are persistent identities; avoid regenerating them during ordinary edits.

Normalization is the compatibility boundary for imported and legacy data:

- BPM is an integer from 20 through 300 or `null`.
- Verse and repeat counts are integers from 1 through 99 or `null`.
- Section font scale is an integer from 100 through 200.
- Persisted editor height is accepted only as a non-negative pixel string.
- Missing or invalid IDs receive bounded replacements.
- Unknown or malformed collections become safe empty arrays.

Read operations for legacy storage must remain side-effect free. Apply migrations when an explicit write occurs rather than rewriting storage during rendering.

## Output contracts

JSON export contains current chart state, including Info fields. It intentionally excludes application-level collections such as all saved charts, groups, favorites, versions, and collected sections.

PDF export is implemented directly with bundled jsPDF. The exporter, not the live preview, is authoritative for pagination and exact output. Review [PDF Output Reference](PDF_OUTPUT.md) before changing chart typography, scaling, colors, metadata order, or page budgeting.

## Release workflow

`.github/workflows/release.yml` runs when a tag matching `v*` is pushed. It builds on:

- macOS 13 for Intel;
- macOS 14 for Apple Silicon;
- current Windows hosted runners.

The workflow uses Node.js 20, stable Rust, a Rust cache, and Tauri's release action. It creates a **draft** GitHub release; a maintainer must inspect assets and publish the release manually.

Before creating a release tag:

1. Update application versions consistently in Rust and Tauri configuration.
2. Run the full JavaScript and Rust test commands.
3. Build locally on a supported platform.
4. Review user-facing documentation and known limitations.
5. Confirm the worktree contains no local plans, review reports, QA evidence, generated output, credentials, or private chart data.
6. Push the commit before pushing the version tag.

Do not weaken action pinning or security checks to make a release pass.

## Documentation maintenance

Public documentation must be durable, product-facing, and free of machine-specific or private context.

Do not commit:

- implementation handoffs or session summaries;
- dated local QA reports and approval ledgers;
- absolute local paths or disposable test directories;
- local agent/environment configuration;
- screenshots containing local data;
- private chart content;
- speculative implementation plans presented as current behavior.

When behavior changes, update the relevant public guide in the same change and add or update a regression test for the code contract.
