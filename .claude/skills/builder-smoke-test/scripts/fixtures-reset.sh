#!/usr/bin/env bash
# Reset examples/agent fixtures:
#   1. Stop any dev server on :4111
#   2. Wipe examples/agent/mastra.db (and -wal / -shm)
#   3. Restore the seeded public skills DB from examples/agent/src/mastra/public/mastra.db
#      (used by the Library page for non-owned public skills)
#
# Usage: bash fixtures-reset.sh
#
# Run from repo root.
set -euo pipefail

if [ ! -d "examples/agent" ]; then
  echo "✗ Run from repo root (examples/agent not found)" >&2
  exit 1
fi

echo "→ Stopping any process listening on :4111 ..."
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :4111 || true)
  if [ -n "${PIDS}" ]; then
    echo "  killing PIDs: ${PIDS}"
    kill ${PIDS} 2>/dev/null || true
    sleep 1
    # force kill any survivors
    REMAIN=$(lsof -ti :4111 || true)
    if [ -n "${REMAIN}" ]; then
      kill -9 ${REMAIN} 2>/dev/null || true
    fi
  fi
fi

echo "→ Wiping examples/agent/mastra.db (and WAL/SHM) ..."
for f in examples/agent/mastra.db examples/agent/mastra.db-wal examples/agent/mastra.db-shm; do
  if [ -f "${f}" ]; then
    rm -f "${f}"
    echo "  removed ${f}"
  fi
done

# The seed DB lives under examples/agent/src/mastra/public/mastra.db and is
# loaded by the Mastra storage layer at startup. It is committed to the repo,
# so we don't need to recreate it — we just confirm it exists.
SEED="examples/agent/src/mastra/public/mastra.db"
if [ -f "${SEED}" ]; then
  echo "✓ Seed DB present at ${SEED} (Library will load public skills on next startup)"
else
  echo "⚠ Seed DB missing at ${SEED}" >&2
  echo "  Library page will be empty until a user creates a public skill." >&2
fi

echo "✓ Fixtures reset. Start the dev server with: (cd examples/agent && pnpm dev)"
