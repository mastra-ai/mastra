#!/usr/bin/env bash
# Poll http://localhost:4111 until it responds 200, up to a 60-second budget.
# Usage: bash wait-for-server.sh [port]
set -euo pipefail

PORT="${1:-4111}"
URL="http://localhost:${PORT}"

echo "Waiting for ${URL} ..."
for i in {1..60}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${URL}" || echo "000")
  if [ "${code}" = "200" ]; then
    echo "✓ ${URL} ready (took ${i}s)"
    exit 0
  fi
  sleep 1
done

echo "✗ ${URL} did not respond 200 within 60s (last code: ${code})" >&2
echo "  Check that the dev server started cleanly. Common causes:" >&2
echo "    - OPENAI_API_KEY missing (server refuses to boot)" >&2
echo "    - Port ${PORT} already in use" >&2
echo "    - AUTH_PROVIDER=workos without MASTRA_FGA_ENABLED=false (FGA crash on tool calls)" >&2
exit 1
