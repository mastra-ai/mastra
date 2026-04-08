#!/bin/bash
# Gateway memory persistence tests
# Usage: ./test-memory.sh <api-url> <api-key>

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

echo "Testing Gateway Memory at $API_URL"
echo "===================================="

THREAD_ID="memory-test-$(date +%s)"
echo "Using thread ID: $THREAD_ID"

FAILURES=0

# Test 1: Establish facts
echo -e "\n[1/4] Establishing facts in memory..."
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 60 -w "\n%{http_code}" \
  -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Remember these facts: My name is TestUser, my favorite color is purple, and my lucky number is 7."}]
  }')

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
if [ "$STATUS" -eq 200 ]; then
  echo "✅ Facts established"
else
  echo "❌ Failed to establish facts (HTTP $STATUS)"
  exit 1
fi

# Small delay for memory sync
sleep 2

# Test 2: Recall name
echo -e "\n[2/4] Testing name recall..."
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 60 -w "\n%{http_code}" \
  -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "What is my name?"}]
  }')

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')
CONTENT=$(echo "$BODY" | jq -r '.choices[0].message.content' 2>/dev/null)

if [ "$STATUS" -eq 200 ] && echo "$CONTENT" | grep -qi "testuser"; then
  echo "✅ Name recalled correctly"
else
  echo "⚠️ Name recall: $CONTENT"
  FAILURES=$((FAILURES + 1))
fi

# Test 3: Recall color
echo -e "\n[3/4] Testing color recall..."
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 60 -w "\n%{http_code}" \
  -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "What is my favorite color?"}]
  }')

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')
CONTENT=$(echo "$BODY" | jq -r '.choices[0].message.content' 2>/dev/null)

if [ "$STATUS" -eq 200 ] && echo "$CONTENT" | grep -qi "purple"; then
  echo "✅ Color recalled correctly"
else
  echo "⚠️ Color recall: $CONTENT"
  FAILURES=$((FAILURES + 1))
fi

# Test 4: Recall number
echo -e "\n[4/4] Testing number recall..."
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 60 -w "\n%{http_code}" \
  -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "What is my lucky number?"}]
  }')

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')
CONTENT=$(echo "$BODY" | jq -r '.choices[0].message.content' 2>/dev/null)

if [ "$STATUS" -eq 200 ] && echo "$CONTENT" | grep -q "7"; then
  echo "✅ Number recalled correctly"
else
  echo "⚠️ Number recall: $CONTENT"
  FAILURES=$((FAILURES + 1))
fi

echo -e "\n===================================="
echo "Memory tests complete (thread: $THREAD_ID)"

if [ "$FAILURES" -gt 0 ]; then
  echo "❌ $FAILURES memory assertion(s) failed"
  exit 1
fi
echo "✅ All memory assertions passed"
