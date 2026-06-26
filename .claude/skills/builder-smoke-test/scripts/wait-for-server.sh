#!/usr/bin/env bash
# Poll the scaffolded smoke-test dev server until /api/agents responds 200.
# Uses /api/agents (not /) because the SPA shell can 200 before the API mounts.
# Detects port-bump (mastra dev increments past :4111 if busy) and reports it.
#
# Usage:
#   bash wait-for-server.sh                       # 60-second budget on :4111
#   bash wait-for-server.sh --budget 90           # 90-second budget on :4111
#   bash wait-for-server.sh --port 4112           # poll a non-default port
#   bash wait-for-server.sh --budget 90 --port 4112
#
# Backwards-compatible positional form (still works):
#   bash wait-for-server.sh 90        # 90s budget on :4111
#   bash wait-for-server.sh 60 4112   # 60s budget on :4112
#
# Positional args: $1 = budget (seconds), $2 = port. Flag args take precedence
# over positional args if both are provided.
set -uo pipefail

BUDGET=""
PORT=""

usage() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
}

# Parse flag-style args first; collect anything else as positional.
positional=()
while [ $# -gt 0 ]; do
  case "$1" in
    --budget) BUDGET="${2:-}"; shift 2 ;;
    --budget=*) BUDGET="${1#--budget=}"; shift ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --port=*) PORT="${1#--port=}"; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "wait-for-server: unknown flag '$1'" >&2; exit 1 ;;
    *) positional+=("$1"); shift ;;
  esac
done

# Fall back to positional args for any value not provided by a flag.
if [ -z "${BUDGET}" ] && [ "${#positional[@]}" -ge 1 ]; then
  BUDGET="${positional[0]}"
fi
if [ -z "${PORT}" ] && [ "${#positional[@]}" -ge 2 ]; then
  PORT="${positional[1]}"
fi

BUDGET="${BUDGET:-60}"
PORT="${PORT:-4111}"

# Validate inputs before any arithmetic. Both must be positive integers.
if ! [[ "${BUDGET}" =~ ^[1-9][0-9]*$ ]]; then
  echo "wait-for-server: --budget must be a positive integer (got '${BUDGET}')" >&2
  exit 2
fi
if ! [[ "${PORT}" =~ ^[1-9][0-9]*$ ]] || [ "${PORT}" -gt 65535 ]; then
  echo "wait-for-server: --port must be an integer between 1 and 65535 (got '${PORT}')" >&2
  exit 2
fi

URL="http://localhost:${PORT}/api/agents"

# Warn if something else is already listening on the target port before polling.
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
  last_code=$(curl -s -o /dev/null -w '%{http_code}' "${URL}" 2>/dev/null)
  [ -z "${last_code}" ] && last_code="000"
  if [ "${last_code}" = "200" ]; then
    echo "✓ ${URL} ready (took ${i}s)"
    exit 0
  fi
  sleep 1
done

echo "✗ ${URL} did not respond 200 within ${BUDGET}s (last code: ${last_code})" >&2

# Check whether mastra dev fell through to a higher port.
for alt in 4112 4113 4114; do
  alt_code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${alt}/api/agents" 2>/dev/null)
  if [ "${alt_code}" = "200" ]; then
    echo "ℹ️  but http://localhost:${alt}/api/agents is up — mastra dev auto-incremented the port." >&2
    echo "    Either free :${PORT} or pass the new port to subsequent curls." >&2
    exit 2
  fi
done

echo "  Common causes:" >&2
echo "    - OPENAI_API_KEY missing → boot crashes in OpenAIVoice ctor before HTTP opens" >&2
echo "    - AUTH_PROVIDER=workos in .env without valid WORKOS_* creds → boot fails inside auth provider" >&2
echo "    - Port ${PORT} bound by a stale process (run: lsof -i :${PORT})" >&2
echo "    - Stale template imports → e.g. \"The requested module '@mastra/editor/ee' does not provide an export named 'builderAgent'\"." >&2
echo "      Fix: ensure src/mastra/index.ts uses 'createBuilderAgent' (factory) and calls it: 'builderAgent: createBuilderAgent()'." >&2
echo "  Tip: tail the dev server log (whatever stdout/stderr file you redirected 'mastra dev' into) — the real error" >&2
echo "       is almost always one of the last ~30 lines before the process exits." >&2
exit 1
