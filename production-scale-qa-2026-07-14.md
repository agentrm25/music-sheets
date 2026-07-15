# Production-scale local QA — 2026-07-14

Status: Approval A and Approval B source/browser/native replay are complete. B01–B23 are fixed for their implemented contracts, every finite native scenario has passed, and the final automated result is 76/76. Production, sensitive data, and real mirror paths remained excluded.

## Safety boundary and test data

- `dist/` and `dist-qa/` are ignored generated outputs. Approval B found that the first QA-seed design wrote into shared `dist/` (B21). The final design generates isolated `dist-qa/`; production `dist/` is seed-free and the production Tauri configuration is unchanged.
- Every native command targeted the exact QA bundle `com.chartcreator.music.qa` at `src-tauri/target/qa-approval-b/release/bundle/macos/chart-creator-qa.app`. The production bundle `com.chartcreator.music` was not launched, production WebKit data was not inspected, and no real mirror path was selected.
- Runtime testing used disposable loopback or isolated QA origins. No real titles, artists, lyrics, notes, mirror paths, or production data were copied into fixtures.
- Scale corpus: 300 charts, 30 groups, 120 collected sections, 30 charts with three versions, favorites, grouped/ungrouped records, Unicode, reserved filename characters, a zero-section chart, a 50-section chart, and long text.
- Dense corpus: 50 sections and 400 lines; it rendered 21 page-break indicators and exported a PDF without console errors.

## Users, roles, routes, and workflows

- There is one local-user permission level; no authentication, authorization, accounts, sharing, or server role exists.
- User perspectives: chart author/editor, band leader/performer, library/setlist organizer, and desktop operator.
- There are no URL routes. The single document has Editor/Library workspaces and Sections/Versions/Info/Collected editor tabs.

## Complete user-facing inventory and acceptance matrix

| ID | Surface and controls | Acceptance criteria | Finite risk edges | Result |
|---|---|---|---|---|
| I01 | Startup, current draft, autosave/status | Restore a valid draft; create Intro/Verse/Chorus when absent; recover safely from corrupt data | absent, corrupt, legacy fields, zero sections, quota | Pass, including isolated-native relaunch, quota autosave failure, and recovery of the prior persisted draft |
| I02 | Editor/Library and four editor tabs | Exactly one workspace/panel active; state and filters survive switching | rapid switches, modal open, 1280/900/700 widths | Pass at 1280/1100/901/700; narrow toolbars scroll without document overflow |
| I03 | Title, artist, key, BPM, time signature, capo, Original Key, arrangement notes | Edits update preview, autosave, and reload; numeric limits hold | empty, 20/300, 19/301, Unicode, long text, clear | Pass; browser-confirmed Original Key and 301→300 blur clamp |
| I04 | Transpose −/+ | Key and chord/grid tokens transpose; lyrics/instructions stay exact; undo/redo restore | no key, flats/sharps, slash/extended chords, 12 steps | Pass; first action exposes working toolbar Undo |
| I05 | Add section top/bottom and six templates | Correct type/line template inserted at requested end and persisted | zero sections, 50 sections, each template | Pass |
| I06 | Section collapse, drag, type, verse number, custom label, repeat, collect, duplicate, delete, resize | Type-specific controls, unique clone IDs, persisted layout, reversible structural edits | 1/99/100, first/last drag, pointer cancel, empty section | Pass, including bounded values, keyboard reorder/focus, native deletion, and exact Undo restoration |
| I07 | Four line types, text/grid inputs, bold, Enter, move, drag, delete | Editor/preview agree; Enter inserts same type; move/drag work across boundaries | empty, first/last, cross-section, unmatched `**`, long unbroken text | Pass, including within/cross-section keyboard reorder and native deletion with exact Undo restoration |
| I08 | Find/replace bar, literal/regex/case, preview highlights | Bar opens; replace is correct and undoable; invalid/no-match is non-destructive | empty, invalid regex, `$`, multi-match, Unicode | Pass; safe text-node highlights, actual match counts, one-step undo, and hidden-context cleanup verified |
| I09 | Preview, theme, zoom 50–200, page guides | Printable state matches data; bounds clamp; dense charts paginate; preference persists | empty, metadata-only, 50 sections/400 lines, long lines | Pass; theme semantics and reload persistence browser-confirmed |
| I10 | Sidebar library search/sort/load/favorite/delete | Correct search/sort; favorite persists; load returns to editor; delete confirms | empty/no-match, duplicate title, 300 charts, clean/dirty load | Pass; load autosaves/focuses Title, delete cancel preserves state, and confirmed local deletion deliberately leaves the external mirror file |
| I11 | Full Library group filters, search/sort, card preview, favorite, group select, load/delete | Counts, filters, four sorts, metadata search, group assignment, and empty states are correct | 300 charts, 30 groups, grouped/ungrouped, status search | Pass; 300 cards, 30 group rows/32 filters, exact search, named explicit Open controls |
| I12 | New/rename/delete group modal | Trim/validate names; rename propagates; assigned group cannot be deleted | blank, duplicate, 30 groups, orphan ID, assigned group | Pass, including assigned-group protection and empty-group cancel/confirm deletion |
| I13 | Versions tab/modal/restore | Complete snapshots and history persist; dirty restore confirms; cancel preserves state | before first save, blank name, clean/dirty restore, many versions | Pass for clean restore, dirty cancel/confirm, parent identity/history preservation, and Undo/Redo round-trip |
| I14 | Info group/status/source/private notes | Fields autosave; private fields never enter preview/PDF | empty, Unicode, group rename/delete | Pass |
| I15 | Collected section modal/cards/insert/delete | Deep-copy collect; inserted IDs are new; source deletion does not break item | blank name, empty section, repeated insert, 120 items | Pass; 120 cards rendered and native delete cancel/confirm removed only the collected copy while preserving its source section |
| I16 | Text import modal/parser | Append detected sections, repeats, chords/lyrics/instructions, and merged grids | empty, CRLF, no heading, custom/numeric headings, large paste | Pass; empty submit shows feedback, keeps the dialog open, and returns focus to input |
| I17 | Open JSON, Save to library, JSON export, PDF export | Valid/invalid files are safe; library Save is distinct from JSON export; PDF succeeds and omits private Info | malformed/legacy/huge, encoding, reserved title, multi-page | Pass: native picker/error/warning/relaunch paths, browser JSON/PDF commands, bounded quota-sized imports, atomic library failure, and recovery all passed |
| I18 | Settings and native folder mirror | Browser explains unavailability; isolated desktop choose/cancel/clear/save/error paths work without collision | removed/unwritable folder, duplicate titles, rename, reserved title | Pass in isolated native QA: cancel/preserve, select/clear, ID-stable rename overwrite, same-title collision, removed folder, read-only folder, and cleared-setting relaunch |
| I19 | New, shortcut, settings, import, version, group, collect, confirm modals | Dialog semantics, initial focus, Escape, focus trap/restore, cancel/confirm | repeated open, backdrop, stacked confirm, keyboard-only | Pass for all Cancel/confirm paths and the accessible in-app Storage full dialog with focused OK |
| I20 | Keyboard shortcuts and status/toasts | Advertised commands work; status is truthful; toast action matches side effect | first edit, redo divergence, save failure, rapid input | Pass, including truthful library-quota and autosave-quota status/toast feedback |

## Runtime measurements and passing evidence

- 300-chart reload: 81 ms, 4,681 DOM nodes in Editor, no page/console errors.
- Full Library: 300 cards/20,491 DOM nodes; open 272 ms; exact search 42 ms; rebuild 393 ms; A–Z sort 460 ms.
- Collected: 120 cards opened in 274 ms. Versions: three snapshots opened in 269 ms.
- Dense chart: 50 sections/400 lines loaded in 231 ms; PDF generated in 287 ms; private Info text absent from preview.
- Metadata happy path persisted title, artist, BPM 300, key, meter, capo, and notes across reload.
- Section templates, custom labels, collapse/expand, duplicate, collect/insert, line add/type/bold/Enter/move, text import, favorites, group creation/assignment, version creation, dirty restore cancel, responsive 1280/700, corrupt storage fallback, legacy normalization, and zero-section state passed.

### Approval A clean replay — 2026-07-15

- Final disposable-origin reset rendered exactly 300 sidebar charts, 50 sections, and 400 lines at 1280px. The document width equaled the viewport, all 4,134 visible controls had an accessible name, and browser warning/error logs were empty.
- Full Library rendered 300 cards, 30 editable group rows, and 32 group filters (All, Ungrouped, and 30 groups). Exact search returned one matching chart and clearing returned all 300.
- Versions rendered three snapshots; Collected rendered 120 cards. Loading a clean saved chart returned to Editor with three sections and focus on Title.
- At widths 1280/1100/901/700, document width never exceeded the viewport. Toolbar actions and the editor toolbar used horizontal overflow where needed; at 901px the 299px find bar exposed its 555px contents through `overflow-x:auto`.
- Regex `(a)\1` with case sensitivity highlighted exactly two lowercase `aa` matches. A lyric containing `<img ... onerror=...>` remained text: zero preview images, no executed marker, replacement reported two occurrences, and one Undo restored both.
- A real browser blur clamped BPM 301 to 300 and updated the preview. Theme state, fixed `Light mode` name, and pressed state persisted through reload.
- Explicit Save added the dense synthetic chart; JSON export reported `JSON saved`; Cmd/Ctrl+E reported `Generating PDF…` then `PDF exported!`; no warning/error was logged. The browser runtime did not expose programmatic Blob saves through its download-event hook, so filenames remain covered by executable regressions.
- Keyboard replay passed semantic tab navigation, section reorder focus, same-section line reorder focus, and cross-section line reorder focus. Modal replay passed shortcut isolation, Tab containment, Escape/cancel, and opener focus restoration.
- Empty text import showed `Paste chart text before importing`, kept one dialog open, and refocused the text box. A chart-delete confirmation was opened and canceled; the 301-chart library remained unchanged.
- Automated result after the browser-found BPM blur and final focused-input Undo fixes: 69 passed, 0 failed, 0 skipped. Twelve changed/untracked JavaScript files passed `node --check`; `git diff --check` was clean; both Tauri JSON files parsed.

### Approval B isolated native replay — 2026-07-15

- Built and launched only `src-tauri/target/qa-approval-b/release/bundle/macos/chart-creator-qa.app`. Its bundle identifier was exactly `com.chartcreator.music.qa`, its title was `Chart Creator QA — ISOLATED`, its executable was matched by full path, and the production bundle/origin was never launched or inspected.
- A fresh QA origin began with zero charts and a blank mirror setting. The QA-only seed then rendered 300 charts, 30 groups, 120 collected sections, and a 50-section/400-line current chart. The library reported 300 charts and 75 ungrouped; relaunch preserved the current synthetic draft.
- The native OS picker passed cancel, malformed JSON, the same malformed file twice, invalid structure, valid import/autosave/relaunch, and a literal U+FFFD encoding-warning import. Invalid files preserved the 50-section draft; valid and warning-only imports did not implicitly add library entries.
- The disposable mirror at `/private/tmp/music-sheets-approval-b.xxDphY` passed blank cancel, select, cancel-with-existing-selection, clear, and clear persistence after relaunch. No real mirror path was selected.
- Saving `qa-b-mirror-alpha` produced `chart-71612d622d6d6972726f722d616c706861.json`; rename rewrote the same file. Saving `qa-b-mirror-beta` with the same title produced a second ID-derived file. Both parsed to the expected IDs/titles and had distinct SHA-256 hashes.
- Clearing the mirror made a subsequent library save local-only without changing either mirror hash. Selecting then removing a disposable folder, and selecting a disposable `0555` folder, each produced local library success plus the visible `saved locally; folder save failed` result. Permissions were restored immediately, and the final blank setting survived relaunch.
- Cancel-first focus was visible for New, chart delete, assigned-group delete, and empty-group delete confirmations. After fresh action-time confirmation, D02–D12 all passed: New created the blank Intro/Verse/Chorus draft; chart deletion removed the local entry but intentionally retained its mirror; assigned-group protection held; empty-group and collected-copy deletion preserved their dependent chart/source data; clean and dirty version restore preserved parent identity/history and completed an Undo/Redo round-trip; and section/line deletion restored exact content through Undo.
- A system application-memory warning interrupted the initial empty-group cancel sequence. At that moment the QA app was 341.5 MB while ChatGPT and Safari were substantially larger. The exact QA PID was stopped and the accumulated computer-control snapshots were reset; `memory_pressure -Q` then reported 80–81% free. No production or unrelated application was quit. Replay later resumed inside the same exact QA boundary and completed without a second warning.
- Quota replay saved three 1 MiB library fixtures before the first library failure at `quota-04`. The error toast was visible and the failed entry was atomically absent, but Tauri blocked the native `alert()` intended to provide recovery instructions. B23 replaced it with the accessible in-app `Storage full` dialog. Evidence: [B23 discovery and accessible dialog](qa/evidence/approval-b-2026-07-15/B23-accessible-storage-full.jpg).
- A live reset/reseed then reproduced the post-fix boundary: `quota-01`, `quota-02`, and `quota-03` saved; `quota-04` autosaved, but Save opened `Storage full` with the exact message `Local storage is full! Please export your chart as JSON or delete older saved charts to free up space.` OK had focus, dismissal left the app responsive, only 01/02/03 remained in the library, and the quota-04 library entry was still absent after relaunch. Evidence: [Q04 post-fix dialog](qa/evidence/approval-b-2026-07-15/Q04-post-fix-quota-04-dialog.jpg).
- Deleting the oldest synthetic quota entry freed enough space for `quota-05` to save; it persisted exactly once across relaunch. Evidence: [Q06 recovered save](qa/evidence/approval-b-2026-07-15/Q06-retry-saved.jpg).
- A bounded 2.5 MiB hidden-info fixture then exercised the separate autosave boundary. Status became `Save failed`, the toast said `Autosave failed: Storage full`, relaunch restored the prior `QA Quota 05` draft, and the library remained unchanged. Evidence: [Q03 autosave Storage full](qa/evidence/approval-b-2026-07-15/Q03-autosave-storage-full.jpg).
- Total quota-fixture bytes were 7,865,838, below the approved 12 MiB ceiling. The failure, atomicity, bounded deletion/retry recovery, persisted recovery, and prior-draft restoration cases all passed.
- Final guarded `--reset` succeeded and visibly restored the 50-section/400-line dense QA chart, `Auto-saved` status, blank Saved songs folder, and disabled Clear. The exact QA executable was then stopped, disposable mirror permissions were restored, `/tmp/music-sheets-approval-b.xxDphY` was deleted with guarded depth-first deletion, and `memory_pressure -Q` ended at 80% free.

## Bug ledger with reproduction evidence

| Bug | Sev | Evidence | Shared cause/dependency |
|---|---|---|---|
| B01 Original Key is dead | P1 | Seeded state preview said “originally in F” while control was blank. Selecting G left preview at F; reload reset control blank. `app.js:114-128`, `ui.js:179-195`. | Form binding/sync drift |
| B02 Numeric bounds are cosmetic | P1 | BPM input declares 20–300, but 301 rendered as “301 BPM” and survived reload. Verse/repeat handlers likewise parse without clamping. | HTML constraints not enforced in state layer |
| B03 Find/replace is unreachable | P1 | Cmd+F and Cmd+H left `#search-replace-bar` at `display:none`; `closeSearchReplace` is undefined. | Advertised UI lacks state transition |
| B04 Shortcut sheet advertises dead commands | P2 | Cmd+E produced no download/toast; no handler exists. Cmd/Ctrl+Click multi-select has no implementation or call site. | Documentation/handler drift |
| B05 Save/JSON contract mismatch | P1 | Button title is “Save Chart as JSON”; click produced no download and instead added/updated the library. `exportJSON()` has no caller. | One control overloaded; orphaned capability |
| B06 Mirror filenames can overwrite distinct charts | P1 | Local identity is chart ID, but mirror filename is sanitized title only; Rust uses overwriting `std::fs::write`. | Cross-layer identity mismatch |
| B07 Clean library load shows a false data-loss warning | P1 | Immediately after Save, clicking another card still showed “Unsaved changes…”. Both library surfaces compare IDs/section count, not `isCurrentChartDirty()`. | Duplicate dirty-check logic |
| B08 Loaded library chart is not autosaved | P1 | `loadChartFromLibrary()` replaces state and renders but never calls `autoSave`; an immediate restart can restore the prior draft. | Persistence transition omitted |
| B09 First structural action cannot use toolbar Undo | P1 | After the first transpose/add-section, Undo was disabled; Cmd+Z worked and enabled Redo. | UndoManager button predicate excludes pending current state |
| B10 Save toast offers an unrelated Undo | P2 | Save toast rendered `"..." saved Undo`; clicking it changed neither the saved library entry nor the current title. | Message substring drives wrong action |
| B11 Theme preference resets | P3 | Light mode applied with white paper, but reload returned to default dark mode. | Preference is not persisted |
| B12 Resized section height is dropped | P2 | Editor writes `section.editorHeight`; `normalizeState()` omits it, so reload/import loses it. | Schema normalizer drift |
| B13 Replace count reports fields, not matches | P2 | Replacement loop increments once per changed field while toast says “occurrences.” `ui.js:197-244`. | Incorrect aggregation semantics |
| B14 Dialog semantics/focus are absent | P1 | 7 overlays, 0 dialogs, 0 `aria-modal`; Settings opened with focus behind it, Escape did nothing, close did not restore focus. | No shared modal controller |
| B15 Keyboard access is incomplete | P1 | 0/4 editor tabs have tab roles/state; 21 line drag handles are nonfocusable; 30 icon actions lack labels; library card content has no role/tabindex. | Click/hover-only dynamic components |
| B16 Group and section actions are hover-only | P2 | Group actions use `display:none` until hover/active and could not be focused/clicked without hover; section actions use opacity only with no `:focus-within`. | CSS hides interactive controls from keyboard |
| B17 Collected delete has no confirmation/undo | P2 | Delete invokes `deleteCollectedSection()` directly. Not clicked because destructive test approval was not granted. | Inconsistent destructive-action policy |
| B18 Empty text import gives no feedback | P3 | Empty Import left modal open with no toast or validation message. | Missing validation state |
| B19 Toolbar clips at 900 px | P2 | At 900px, toolbar scroll width was 914px, overflow-x visible, and Export PDF ended at x=914 beyond the viewport; scrolling is enabled only at 700px. | Breakpoints do not cover toolbar width |
| B20 Desktop startup can mutate real data | P1 | `init()` calls library render; `getSavedCharts()` normalizes then rewrites storage. Real WebKit data and a live mirror setting exist. | No isolated test identifier/read-only migration boundary |
| B21 QA build can contaminate production assets | P1 | The first Approval B build injected `qa-native-seed.js` into the same ignored `dist/` used by production. A concurrent or later server could have served the seed under a production origin. Production was not launched, and its WebKit data timestamp did not change. | QA and production shared a generated frontend directory |
| B22 Destructive QA runs cannot reproduce the baseline | P2 | The seed marker intentionally preserves mutations, but the runner initially had no explicit way to reset only `com.chartcreator.music.qa`. A full destructive rerun would otherwise require manual WebKit cleanup. | Persistence behavior lacked an isolated reset/reseed contract |
| B23 Native quota alert is blocked | P1 | At the first library quota failure (`quota-04`), the error toast appeared and the entry remained atomically absent, but Tauri did not display the recovery instructions sent through native `alert()`. | Browser-native blocking dialogs are not a reliable desktop/Tauri feedback channel |

### Bug resolution and regression evidence

| Bug | Result | Regression/browser/native evidence |
|---|---|---|
| B01 | Fixed | Original Key hydrates, edits, autosaves, and uses the same major/minor option set as Key; browser changed it and preview reflected it. |
| B02 | Fixed | State normalization clamps BPM 20–300 and verse/repeat 1–99. Browser-found blur omission received a red→green regression; 301 visibly became 300. |
| B03 | Fixed | Find/replace opens from Cmd/Ctrl+F/H, safely highlights text nodes, supports regex/case, restores context, and cannot revive a hidden search after Library navigation. |
| B04 | Fixed | Shortcut sheet matches implemented commands; Cmd/Ctrl+E completed PDF generation in browser. Unsupported multi-select text was removed. |
| B05 | Fixed | Separate Save to Library and Export JSON controls/handlers; browser observed distinct save and JSON success paths; empty filename falls back to `chart.json`. |
| B06 | Fixed | Mirror names use the full UTF-8 chart ID encoded as hex with a 100-byte input cap; native rename and duplicate-title writes produced the expected stable, collision-free files. |
| B07 | Fixed | Both library surfaces delegate to one dirty predicate and explicit Open action; saved clean chart loaded without a false warning. |
| B08 | Fixed | Library load immediately autosaves, refreshes workflow panels, switches to Editor, and focuses Title. |
| B09 | Fixed | Undo manager derives controls from live history, enforces its cap on every append, and first structural edits are immediately undoable. |
| B10 | Fixed | Toast actions are explicit; success-message text no longer invents an unrelated chart Undo. |
| B11 | Fixed | Theme is stored in settings; browser toggle semantics and reload persistence passed. |
| B12 | Fixed | Valid pixel editor heights survive normalization; invalid values are rejected. |
| B13 | Fixed | Replace counts actual matches across fields, uses one undo transaction, and leaves no-match state/history untouched; browser reported exactly two. |
| B14 | Fixed | Shared modal controller supplies dialog labels, modal state, stack, focus trap, Escape, and opener restore; app shortcuts no longer steal native Undo from modal or focused editor inputs. |
| B15 | Fixed | Tabs, cards, icon controls, line handles, and section handles are named and keyboard-operable; zero unnamed visible controls in the final scale replay. |
| B16 | Fixed | Group/section actions expose keyboard focus styles; line keyboard movement crosses section boundaries while restoring focus. |
| B17 | Fixed and native-verified | Collected deletion now uses confirmation; native Cancel preserved the collected copy, and confirm removed only that copy while leaving its source section intact. |
| B18 | Fixed | Empty import now gives an error, leaves the modal open, and focuses the textarea. |
| B19 | Fixed | Toolbar, editor toolbar, and find bar expose horizontal scrolling at production breakpoints without page overflow. |
| B20 | Fixed and native-verified | Legacy draft/library/group/collected/version reads receive stable deterministic IDs without storage writes; the packaged QA identifier/origin/title and fresh blank origin were verified without launching production. |
| B21 | Fixed | QA now builds exclusively into ignored `dist-qa/`; the production `dist/` tree remains byte-for-byte unchanged during QA preparation. A focused regression enforces the boundary. |
| B22 | Fixed and native-verified | `script/build_and_run.sh --reset` is hard-gated to `~/Library/WebKit/com.chartcreator.music.qa`, stops only the exact QA executable, and reseeds an empty store. The post-B23 quota replay exercised the live reset/reseed path successfully. |
| B23 | Fixed and native-verified | Library quota failure now opens the shared modal stack as an accessible `Storage full` dialog with focused OK, never calls native `alert()`, preserves atomic failure, and retains the error toast. The native screenshot and focused regression cover visibility, focus, acknowledgment, and storage atomicity. |

## Shared-cause review and proposed fix groups

1. **UI contract/wiring:** B01, B03–B05, B11, B18. Centralize control binding and make Save Library, Export JSON, PDF, search, and documented shortcuts explicit.
2. **State/persistence invariants:** B02, B07–B09, B12–B13. Enforce numeric bounds, one dirty predicate, autosave every state transition, preserve normalized fields, and correct undo/count semantics.
3. **Identity/data/build isolation:** B06, B20–B21. Use chart IDs in mirror filenames, isolate the QA identifier and WebKit origin, and give synthetic QA its own generated frontend directory.
4. **Interaction/accessibility:** B14–B17, B19. Add a shared dialog controller, semantic tabs/cards, keyboard-visible actions, accessible drag alternatives, and the missing responsive overflow rule.
5. **QA build/replay isolation:** B21–B22. Give QA a separate frontend directory, exact process/data paths, and an explicit bounded reset/reseed mode.
6. **Native-compatible failure feedback:** B23. Route blocking recovery guidance through the accessible in-app modal stack instead of browser-native `alert()`.

## Approval A implementation contract and result

The user approved the coherent B01–B20 source set despite the repository's five-file/200-line guardrail. The implementation changed 10 runtime files and added one isolated Tauri config, four regression files, and this report. `dist/`, production configuration, native state, and real mirror paths were not changed.

| Change set | Exact seams | Bugs | Required regression contract |
|---|---|---|---|
| State and persistence invariants | `app.js`; `src-js/state.js`, `editor.js`, `import-export.js`, `storage.js` | B01–B02, B06–B08, B11–B12, B20 | Clamp BPM to 20–300 and verse/repeat to 1–99 at input and normalization boundaries; bind Original Key; use stable ID-only mirror filenames; centralize dirty-load confirmation; immediately autosave a loaded chart; persist theme and valid pixel heights; make library reads side-effect free |
| Commands, history, and feedback | `app.js`; `index.html`; `src-js/undo.js`, `ui.js` | B03–B05, B09–B10, B13, B18 | Open/close find-replace from shortcuts; implement Cmd/Ctrl+E; separate Save to Library from Export JSON; enable Undo after the first live mutation; remove message-inferred Undo; count actual regex matches; reject empty imports visibly |
| Accessible interaction and layout | `index.html`; `style.css`; `src-js/ui.js`, `workflow.js`, `editor.js`, `storage.js` | B14–B17, B19 | One modal stack with labels, focus trap/Escape/restore; semantic arrow-key tabs; named icon/reorder controls; keyboard-openable library cards; `:focus-within`/no-hover actions; confirmed collected deletion; toolbar actions reachable at 900px and with the new JSON control |
| Isolated QA and regressions | new `src-tauri/tauri.qa.conf.json`; new `tests/app-regressions.test.js`, `tests/contract-regressions.test.js`, `tests/state-normalization.test.js`, `tests/undo-manager.test.js` | B01–B20 | QA identifier/product/origin/title differ from production; fake DOM and write-tracking storage exercise real modules; named regressions cover the bug set; source/ARIA/CSS/config contracts stay executable with built-in Node tooling |

Chosen minimum product policies for this fix pass:

- Keep Cmd/Ctrl+S as **Save to Library**, expose **Export JSON** separately, implement Cmd/Ctrl+E for PDF, and remove the unsupported multi-select shortcut claim.
- Keep dark as the default theme while persisting an explicit user choice.
- Confirm collected-section deletion; do not misuse chart Undo for separate collected storage.
- Use Cancel-first modal focus, restore the opener, and prohibit backdrop dismissal for destructive confirmation.
- Use the shared accessible in-app modal stack for blocking recovery guidance; do not depend on browser-native `alert()` in Tauri.
- Mirror as `chart-<hex-encoded full chart ID>.json`; never auto-delete or rename legacy title-based mirror files.
- Preserve only non-negative pixel `editorHeight` values; lazily normalize legacy storage on the next explicit write, never on read.

Automated validation ran `node --test --test-concurrency=1 tests/*.test.js`. Browser replay covered export command completion, keyboard/focus behavior, accessibility state, computed visibility, and widths 1,280/1,100/901/700. At the Approval A handoff, native replay remained separately gated to `com.chartcreator.music.qa` plus a new disposable mirror directory; Approval B later completed that isolated replay.

## Verification and remaining coverage

- `node --test --test-concurrency=1 tests/*.test.js`: 76/76 passed, including B23 dialog visibility/focus/acknowledgment and atomic library failure.
- `node --check` passed for the changed JavaScript entry points, `bash -n script/build_and_run.sh` passed, both Tauri JSON files parsed, and `git diff --check` passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` completed in an isolated target: both test binaries and doc tests passed (the Rust crate currently defines zero unit tests).
- Production `dist/` is regenerated from source and contains no QA seed. QA preparation writes only ignored `dist-qa/`; source-to-production-dist comparisons and a byte-identity regression pass.
- The packaged native build, production-scale render, OS JSON picker, persistence, disposable mirror success/error paths, D02–D12 destructive paths, live reset/reseed, and bounded quota failure/recovery paths passed under `com.chartcreator.music.qa`.
- Bundle identifier, exact executable-path targeting, QA-seed exclusion from production `dist/`, and the 7,865,838-byte quota ceiling all passed their final checks.
- All finite Approval B scenarios were executed. Final guarded reset/reseed, exact-process stop, permission restoration, and disposable-root deletion completed; retained evidence is under `qa/evidence/approval-b-2026-07-15/`.
- Permanently excluded without separate approval: production WebKit data, `com.chartcreator.music`, the real mirror directory, sensitive data, and production deployment.
