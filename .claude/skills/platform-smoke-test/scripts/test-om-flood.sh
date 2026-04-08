#!/bin/bash
# OM Flood Test - Test gateway behavior under rapid message load
# Usage: ./test-om-flood.sh [api-url] [api-key] [count]

set -e

# Cleanup on exit
cleanup() {
  rm -rf "$TMPDIR" 2>/dev/null || true
}
trap cleanup EXIT

# Preflight checks
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed"; exit 1; }

API_URL="${1:-${API_URL:-https://server.mastra.ai}}"
API_KEY="${2:-$MASTRA_API_KEY}"
COUNT="${3:-20}"

if [ -z "$API_KEY" ]; then
  echo "Error: API key required. Pass as second argument or set MASTRA_API_KEY"
  exit 1
fi

THREAD_ID="om-flood-$(date +%s)"

echo "OM Flood Test"
echo "============="
echo "API URL: $API_URL"
echo "Thread ID: $THREAD_ID"
echo "Sending $COUNT concurrent messages..."
echo ""

# Track results
SUCCESS=0
FAILED=0
TMPDIR=$(mktemp -d)

# Send messages rapidly without waiting
for i in $(seq 1 $COUNT); do
  (
    set +e
    RESPONSE=$(curl -s --connect-timeout 10 --max-time 60 -w "\n%{http_code}" \
      -X POST "$API_URL/v1/chat/completions" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -H "x-thread-id: $THREAD_ID" \
      -d "{\"model\": \"openai/gpt-4o-mini\", \"messages\": [{\"role\": \"user\", \"content\": \"Rapid message $i - respond with just the number $i\"}]}")
    CURL_EXIT=$?
    set -e
    
    if [ "$CURL_EXIT" -ne 0 ]; then
      echo "curl_error_$CURL_EXIT" > "$TMPDIR/failed_$i"
      exit 0
    fi
    
    STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
    
    if [ "$STATUS" -eq 200 ]; then
      echo "1" > "$TMPDIR/success_$i"
    else
      echo "$STATUS" > "$TMPDIR/failed_$i"
    fi
  ) &
done

# Wait for all background requests
echo "Waiting for all requests to complete..."
wait

# Count results
SUCCESS=$(ls -1 "$TMPDIR"/success_* 2>/dev/null | wc -l | tr -d ' ')
FAILED=$(ls -1 "$TMPDIR"/failed_* 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "Results"
echo "======="
echo "Success: $SUCCESS/$COUNT"
echo "Failed: $FAILED/$COUNT"

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "Failed status codes:"
  cat "$TMPDIR"/failed_* 2>/dev/null | sort | uniq -c
fi

echo ""
echo "Thread ID for dashboard verification: $THREAD_ID"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
