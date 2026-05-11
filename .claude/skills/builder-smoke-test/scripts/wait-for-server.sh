#!/usr/bin/env bash
# Poll the examples/agent dev server until /api/agents responds 200.
# Uses /api/agents (not /) because the SPA shell can 200 before the API mounts.
# Detects port-bump (mastra dev increments past :4111 if busy) and reports it.
#
# Usage:
#   bash wait-for-server.sh           # 60-second budget on :4111
#   bash wait-for-server.sh 90        # 90-second budget on :4111
#   bash wait-for-server.sh 60 4112   # custom port
set -uo pipefail

BUDGET="${1:-60}"
PORT="${2:-4111}"
URL="http://localhost:${PORT}/api/agents"

# Warn if something else is already listening on :4111 before we start polling.
if command -v lsof >/dev/null 2>&1; then
  zombie=$(lsof -i :"${PORT}" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "${zombie}" ]; then
    echo "ℹ️  port ${PORT} already has a listener (pid: ${zombie})."
    echo "    If this is a stale mastra dev from an earlier run, kill it before continuing:"
    echo "      kill ${zombie}"
  fi
fi

echo "Waiting for ${URL} (budget: ${BUDGET}s) ..."
last_code="000"
for ((i=1; i<=BUDGET; i++)); do
  last_code=$(curl -s -o /dev/null -w '%{http_code}' "${URL}" || echo "000")
  if [ "${last_code}" = "200" ]; then
    echo "✓ ${URL} ready (took ${i}s)"
    exit 0
  fi
  sleep 1
done

echo "✗ ${URL} did not respond 200 within ${BUDGET}s (last code: ${last_code})" >&2

# Check whether mastra dev fell through to a higher port.
for alt in 4112 4113 4114; do
  alt_code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${alt}/api/agents" || echo "000")
  if [ "${alt_code}" = "200" ]; then
    echo "ℹ️  but http://localhost:${alt}/api/agents is up — mastra dev auto-incremented the port." >&2
    echo "    Either free :${PORT} or pass the new port to subsequent curls." >&2
    exit 2
  fi
done

echo "  Common causes:" >&2
echo "    - OPENAI_API_KEY missing → boot crashes in OpenAIVoice ctor before HTTP opens" >&2
echo "    - AUTH_PROVIDER=workos without MASTRA_FGA_ENABLED=false → FGA crash on first call" >&2
echo "    - Port ${PORT} bound by a stale process (run: lsof -i :${PORT})" >&2
exit 1
