#!/bin/bash
# Gateway API endpoint tests
# Usage: ./test-api.sh <api-url> <api-key>

set -e

# Preflight checks
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed"; exit 1; }

API_URL="${1:-https://server.mastra.ai}"
API_KEY="${2:-$MASTRA_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "Error: API key required. Pass as second argument or set MASTRA_API_KEY"
  exit 1
fi

echo "Testing Gateway API at $API_URL"
echo "================================"

FAILURES=0

# Test 1: Basic chat completion
echo -e "\n[1/5] Testing /v1/chat/completions (basic)..."
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 30 -w "\n%{http_code}" \
  -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o-mini", "messages": [{"role": "user", "content": "Say hello in exactly 3 words"}]}')

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')

if [ "$STATUS" -eq 200 ]; then
  echo "✅ Chat completions: OK"
  echo "   Response: $(echo "$BODY" | jq -r '.choices[0].message.content' 2>/dev/null | head -c 50)..."
else
  echo "❌ Chat completions: FAILED (HTTP $STATUS)"
  echo "   Error: $BODY"
  FAILURES=$((FAILURES + 1))
fi

# Test 2: Chat completion with thread ID
echo -e "\n[2/5] Testing /v1/chat/completions (with x-thread-id)..."
THREAD_ID="test-$(date +%s)"
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 30 -w "\n%{http_code}" \
  -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o-mini", "messages": [{"role": "user", "content": "Remember: test value is 42"}]}')

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')

if [ "$STATUS" -eq 200 ]; then
  echo "✅ Chat with thread: OK (thread: $THREAD_ID)"
else
  echo "❌ Chat with thread: FAILED (HTTP $STATUS)"
  echo "   Error: $BODY"
  FAILURES=$((FAILURES + 1))
fi

# Test 3: Memory recall
echo -e "\n[3/5] Testing memory recall..."
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 30 -w "\n%{http_code}" \
  -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o-mini", "messages": [{"role": "user", "content": "What is the test value I told you?"}]}')

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')

if [ "$STATUS" -eq 200 ]; then
  CONTENT=$(echo "$BODY" | jq -r '.choices[0].message.content' 2>/dev/null)
  if echo "$CONTENT" | grep -qi "42"; then
    echo "✅ Memory recall: OK (recalled '42')"
  else
    echo "⚠️ Memory recall: Response received but may not contain expected value"
    echo "   Response: $(echo "$CONTENT" | head -c 100)..."
  fi
else
  echo "❌ Memory recall: FAILED (HTTP $STATUS)"
  FAILURES=$((FAILURES + 1))
fi

# Test 4: List threads
echo -e "\n[4/5] Testing /v1/threads (list)..."
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 30 -w "\n%{http_code}" \
  -X GET "$API_URL/v1/threads" \
  -H "Authorization: Bearer $API_KEY")

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')

if [ "$STATUS" -eq 200 ]; then
  echo "✅ List threads: OK"
elif [ "$STATUS" -eq 404 ]; then
  echo "⚠️ List threads: Endpoint not found (may not be implemented)"
else
  echo "❌ List threads: FAILED (HTTP $STATUS)"
  FAILURES=$((FAILURES + 1))
fi

# Test 5: Invalid API key
echo -e "\n[5/5] Testing auth (invalid key)..."
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 30 -w "\n%{http_code}" \
  -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer invalid-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o-mini", "messages": [{"role": "user", "content": "test"}]}')

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)

if [ "$STATUS" -eq 401 ]; then
  echo "✅ Auth rejection: OK (401 returned)"
else
  echo "❌ Auth rejection: FAILED (expected 401, got $STATUS)"
  FAILURES=$((FAILURES + 1))
fi

echo -e "\n================================"
echo "Gateway API tests complete"

if [ "$FAILURES" -gt 0 ]; then
  echo "Failed checks: $FAILURES"
  exit 1
fi
