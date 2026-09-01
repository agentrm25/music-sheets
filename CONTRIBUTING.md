# Contributing to Chart Creator

Chart Creator is a small local-first application. Contributions should keep behavior understandable, preserve user data, and avoid adding build complexity without a clear benefit.

## Before opening a change

1. Search existing issues and pull requests for related work.
2. Keep the change focused on one behavior or documentation concern.
3. Do not include real chart content, exported user data, credentials, absolute local paths, or screenshots containing private information.
4. For data-format, persistence, destructive-action, security, or release changes, explain the migration and failure behavior before implementation.

This repository currently has no license. Public visibility alone does not grant reuse rights.

## Development setup

Follow the complete [Development Guide](docs/DEVELOPMENT.md). The shortest browser workflow is:

```bash
node build.js
npx --yes http-server@14.1.1 dist -p 1420
```

Run the desktop application with:

```bash
npm exec --yes --package=@tauri-apps/cli@2.11.4 -- tauri dev
```

Do not edit generated `dist/`, `dist-qa/`, or `src-tauri/target/` content.

## Make a focused change

- Follow existing vanilla JavaScript and shared `window.ChartApp` module patterns.
- Preserve persistent chart, section, and line IDs during normal edits.
- Normalize imported or legacy data at the state boundary.
- Keep library reads side-effect free.
- Use the shared in-application dialog and toast patterns rather than browser-native blocking dialogs.
- Preserve keyboard and pointer access for every interactive action.
- Keep browser mode functional when a Tauri API is unavailable.
- Treat PDF behavior as a public output contract.

Avoid unrelated refactors in a bug fix. If a broader refactor is necessary, explain why the smaller change is unsafe or incomplete.

## Add tests

Bug fixes should include a regression that fails before the fix and passes after it. New features should cover the main workflow and at least one boundary or failure case.

Run:

```bash
node --test --test-concurrency=1 tests/*.test.js
cargo test --manifest-path src-tauri/Cargo.toml
```

Run focused syntax or test commands while iterating, but use both full commands before requesting review.

For visible interface changes, also check:

- keyboard-only operation;
- focus placement and restoration;
- accessible names and state;
- narrow-window toolbar access;
- light and dark themes;
- browser mode and desktop-only fallbacks;
- autosave and Undo behavior.

For PDF changes, follow the verification checklist in [PDF Output Reference](docs/PDF_OUTPUT.md).

## Update public documentation

Update documentation in the same change whenever users, contributors, data behavior, keyboard commands, builds, or output contracts change.

Public documentation belongs in:

- `README.md` for product entry points and essential setup;
- `docs/USER_GUIDE.md` for user workflows;
- `docs/DATA_AND_PRIVACY.md` for persistence, backups, and privacy;
- `docs/PDF_OUTPUT.md` for printable-output behavior;
- `docs/DEVELOPMENT.md` for architecture, tests, QA, and releases;
- `CONTRIBUTING.md` for contribution expectations.

Do not commit locally tailored documentation or evidence, including:

- implementation plans or session handoffs;
- code/security review reports;
- dated QA approval ledgers;
- local agent or editor configuration;
- disposable filesystem paths;
- local screenshots, performance captures, or replay logs;
- speculative roadmaps presented as implemented behavior.

The repository ignore rules cover common local names, but contributors remain responsible for reviewing the staged diff.

## Prepare the pull request

Before pushing:

```bash
git status --short
git diff --check
git diff --cached --stat
```

The pull request description should state:

- what changed;
- why it changed;
- how it was tested;
- any data compatibility or migration effect;
- any remaining limitation or risk.

Keep commit subjects imperative and no longer than 72 characters. Do not commit secrets, generated dependencies, private data, or machine-specific configuration.

## Security-sensitive reports

Do not publish exploit details, private chart data, credentials, or sensitive filesystem information in a public issue. Use GitHub's private vulnerability-reporting channel if it is available for the repository. If no private channel is available, open a minimal issue requesting a private contact path without disclosing the vulnerability.
