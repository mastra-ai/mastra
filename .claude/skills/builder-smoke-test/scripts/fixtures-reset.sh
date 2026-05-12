#!/usr/bin/env bash
# Reset the scaffolded smoke-test project fixtures:
#   1. Stop any dev server on :4111
#   2. Wipe $PROJECT_DIR/mastra.db (and -wal / -shm)
#
# Usage:
#   bash fixtures-reset.sh
#
# Honors $PROJECT_DIR if set; defaults to ~/mastra-builder-smoke-tests/builder-smoke.
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-${HOME}/mastra-builder-smoke-tests/builder-smoke}"

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
