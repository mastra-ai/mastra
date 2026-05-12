#!/usr/bin/env bash
# Reset the scaffolded smoke-test project fixtures:
#   1. Stop any dev server on :4111
#   2. Wipe $PROJECT_DIR/mastra.db (and -wal / -shm)
#
# Project dir resolution (first wins):
#   1. --dir <path> flag
#   2. $PROJECT_DIR env var
#   3. $BUILDER_SMOKE_TEST_DIR env var
#   4. ~/mastra-builder-smoke-tests/builder-smoke  (default)
#
# Usage:
#   bash fixtures-reset.sh
#   bash fixtures-reset.sh --dir /custom/path
#   BUILDER_SMOKE_TEST_DIR=/custom/path bash fixtures-reset.sh
set -uo pipefail

DEFAULT_PROJECT_DIR="${HOME}/mastra-builder-smoke-tests/builder-smoke"
CLI_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) CLI_DIR="${2:-}"; shift 2 ;;
    --dir=*) CLI_DIR="${1#--dir=}"; shift ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "fixtures-reset: unknown arg '$1'" >&2; exit 2 ;;
  esac
done

PROJECT_DIR="${CLI_DIR:-${PROJECT_DIR:-${BUILDER_SMOKE_TEST_DIR:-$DEFAULT_PROJECT_DIR}}}"

if [ ! -d "${PROJECT_DIR}" ]; then
  echo "✗ Scaffolded project not found at ${PROJECT_DIR}" >&2
  echo "  Run scripts/scaffold.sh (or preflight.sh) first." >&2
  exit 1
fi

echo "→ Stopping any process listening on :4111 ..."
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :4111 || true)
  if [ -n "${PIDS}" ]; then
    echo "  killing PIDs: ${PIDS}"
    kill ${PIDS} 2>/dev/null || true
    sleep 1
    REMAIN=$(lsof -ti :4111 || true)
    if [ -n "${REMAIN}" ]; then
      kill -9 ${REMAIN} 2>/dev/null || true
    fi
  fi
fi

echo "→ Wiping ${PROJECT_DIR}/mastra.db (and WAL/SHM) ..."
for f in "${PROJECT_DIR}/mastra.db" "${PROJECT_DIR}/mastra.db-wal" "${PROJECT_DIR}/mastra.db-shm"; do
  if [ -f "${f}" ]; then
    rm -f "${f}"
    echo "  removed ${f}"
  fi
done

echo "✓ Fixtures reset. Start the dev server with: (cd ${PROJECT_DIR} && pnpm mastra:dev) — or restart via the smoke-test preflight."
