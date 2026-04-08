#!/bin/bash
# OM History Replay Test - Test what happens when client sends full conversation history
# Usage: ./test-om-history-replay.sh [api-url] [api-key]
#
# This simulates a stateless client that sends the full conversation history
# with each request, testing how Gateway handles duplicate message detection.

set -e

# Preflight checks
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed"; exit 1; }

API_URL="${1:-${API_URL:-https://server.mastra.ai}}"
API_KEY="${2:-$MASTRA_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "Error: API key required. Pass as second argument or set MASTRA_API_KEY"
  exit 1
fi

THREAD_ID="om-replay-$(date +%s)"

echo "OM History Replay Test"
echo "======================"
echo "API URL: $API_URL"
echo "Thread ID: $THREAD_ID"
echo ""

# Phase 1: Build up history with 5 messages
echo "Phase 1: Building conversation history (5 messages)..."
echo ""

for i in {1..5}; do
  RESPONSE=$(curl -s --connect-timeout 10 --max-time 60 -w "\n%{http_code}" \
    -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -H "x-thread-id: $THREAD_ID" \
    -d "{\"model\": \"openai/gpt-4o-mini\", \"messages\": [{\"role\": \"user\", \"content\": \"Message $i - remember this number: $((i * 10))\"}]}")
  
  STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
  BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')
  TOKENS=$(echo "$BODY" | jq '.usage.prompt_tokens // 0')
  
  echo "  Message $i: HTTP $STATUS, prompt_tokens=$TOKENS"
  
  if [ "$STATUS" -ne 200 ]; then
    echo "ERROR: Failed to send message $i"
    exit 1
  fi
  
  sleep 1
done

echo ""
echo "Phase 2: Sending full history replay..."
echo ""

# Phase 2: Send ALL history again (simulating stateless client)
RESPONSE=$(curl -s --connect-timeout 10 --max-time 60 -w "\n%{http_code}" \
  -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Message 1 - remember this number: 10"},
      {"role": "assistant", "content": "I will remember that the number is 10."},
      {"role": "user", "content": "Message 2 - remember this number: 20"},
      {"role": "assistant", "content": "I will remember that the number is 20."},
      {"role": "user", "content": "Message 3 - remember this number: 30"},
      {"role": "assistant", "content": "I will remember that the number is 30."},
      {"role": "user", "content": "Message 4 - remember this number: 40"},
      {"role": "assistant", "content": "I will remember that the number is 40."},
      {"role": "user", "content": "Message 5 - remember this number: 50"},
      {"role": "assistant", "content": "I will remember that the number is 50."},
      {"role": "user", "content": "Message 6 - This is a NEW message after full replay. What numbers do you remember?"}
    ]
  }')

STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')
TOKENS=$(echo "$BODY" | jq '.usage.prompt_tokens // 0')
CONTENT=$(echo "$BODY" | jq -r '.choices[0].message.content // "no content"' | head -c 200)

if [ "$STATUS" -ne 200 ]; then
  echo "ERROR: Full history replay failed (HTTP $STATUS)"
  echo "$BODY"
  exit 1
fi

echo "Full history replay:"
echo "  HTTP Status: $STATUS"
echo "  Prompt tokens: $TOKENS"
echo "  Response preview: $CONTENT..."
echo ""

# Phase 3: Check if Gateway detected the replay
echo "Phase 3: Verify thread state..."
echo ""

THREAD_RESPONSE=$(curl -s --connect-timeout 10 --max-time 30 -w "\n%{http_code}" \
  -X GET "$API_URL/v1/memory/threads/$THREAD_ID/messages" \
  -H "Authorization: Bearer $API_KEY")

THREAD_STATUS=$(printf '%s\n' "$THREAD_RESPONSE" | tail -n 1)
THREAD_BODY=$(printf '%s\n' "$THREAD_RESPONSE" | sed '$d')

if [ "$THREAD_STATUS" -ne 200 ]; then
  echo "ERROR: Thread lookup failed (HTTP $THREAD_STATUS)"
  echo "$THREAD_BODY"
  exit 1
fi

MESSAGE_COUNT=$(echo "$THREAD_BODY" | jq '.messages | length // 0')

echo "Thread messages in Gateway: $MESSAGE_COUNT"
echo ""
echo "Summary"
echo "======="
echo "Thread ID: $THREAD_ID"
echo "Messages sent individually: 5"
echo "Messages in full replay: 11 (5 user + 5 assistant + 1 new)"
echo "Final message count in Gateway: $MESSAGE_COUNT"
echo ""
echo "Check the dashboard to verify thread state and message deduplication."
