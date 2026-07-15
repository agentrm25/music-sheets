#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="chart-creator-qa"
BUNDLE_ID="com.chartcreator.music.qa"
TAURI_CLI_PACKAGE="@tauri-apps/cli@2.11.4"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QA_CONFIG="$ROOT_DIR/src-tauri/tauri.qa.conf.json"
QA_TARGET_DIR="$ROOT_DIR/src-tauri/target/qa-approval-b"
BUNDLE_DIR="$QA_TARGET_DIR/release/bundle/macos"
APP_BUNDLE="$BUNDLE_DIR/$APP_NAME.app"
QA_WEBKIT_DIR="$HOME/Library/WebKit/$BUNDLE_ID"

bundle_executable() {
  local executable_name
  executable_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_BUNDLE/Contents/Info.plist")"
  printf '%s/Contents/MacOS/%s\n' "$APP_BUNDLE" "$executable_name"
}

stop_running() {
  if [[ -d "$APP_BUNDLE" ]]; then
    local binary pid
    binary="$(bundle_executable)"
    while IFS= read -r pid; do
      [[ -n "$pid" ]] && /bin/kill "$pid"
    done < <(/usr/bin/pgrep -fx "$binary" || true)
  fi
}

reset_qa_data() {
  if [[ "$BUNDLE_ID" != "com.chartcreator.music.qa" ]] ||
     [[ "$QA_WEBKIT_DIR" != "$HOME/Library/WebKit/com.chartcreator.music.qa" ]]; then
    echo "Refusing to reset an unexpected WebKit data path: $QA_WEBKIT_DIR" >&2
    exit 1
  fi

  if [[ -e "$QA_WEBKIT_DIR" || -L "$QA_WEBKIT_DIR" ]]; then
    /bin/rm -r -- "$QA_WEBKIT_DIR"
  fi
}

build_qa() {
  cd "$ROOT_DIR"
  CARGO_TARGET_DIR="$QA_TARGET_DIR" npm exec --yes --package="$TAURI_CLI_PACKAGE" -- tauri build \
    --ci \
    --config "$QA_CONFIG" \
    --bundles app \
    --no-sign

  if [[ ! -d "$APP_BUNDLE" ]]; then
    echo "QA app bundle not found at $APP_BUNDLE" >&2
    exit 1
  fi

  local actual_id
  actual_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_BUNDLE/Contents/Info.plist")"
  if [[ "$actual_id" != "$BUNDLE_ID" ]]; then
    echo "Refusing to launch unexpected bundle identifier: $actual_id" >&2
    exit 1
  fi
}

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

wait_for_pid() {
  local pid
  for _ in {1..20}; do
    pid="$(/usr/bin/pgrep -fx "$APP_BINARY" | head -n 1 || true)"
    if [[ -n "$pid" ]]; then
      printf '%s\n' "$pid"
      return 0
    fi
    sleep 0.25
  done
  return 1
}

stop_running
build_qa
APP_BINARY="$(bundle_executable)"

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    APP_PID="$(wait_for_pid)"
    /usr/bin/log stream --info --style compact --predicate "processID == $APP_PID"
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    open_app
    if ! wait_for_pid >/dev/null; then
      echo "QA app process did not start: $APP_BINARY" >&2
      exit 1
    fi
    ;;
  --reset|reset)
    reset_qa_data
    open_app
    if ! wait_for_pid >/dev/null; then
      echo "QA app process did not start after reset: $APP_BINARY" >&2
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify|--reset]" >&2
    exit 2
    ;;
esac
