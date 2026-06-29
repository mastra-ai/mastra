#!/bin/bash
#
# Test a deployed Mastra server by calling an agent endpoint
#
# Usage: ./test-server.sh <server-url> [agent-id] [message]
#
# Examples:
#   ./test-server.sh https://my-project.server.staging.mastra.cloud
#   ./test-server.sh https://my-project.server.mastra.cloud weather-agent
#   ./test-server.sh https://my-project.server.staging.mastra.cloud weather-agent "What's the weather in Tokyo?"

set -e

# Check required dependencies
for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required dependency '$cmd' is not installed."
    exit 1
  fi
done

SERVER_URL="${1:-}"
AGENT_ID="${2:-weather-agent}"
MESSAGE="${3:-What is the weather in Paris?}"

if [ -z "$SERVER_URL" ]; then
    echo "Usage: $0 <server-url> [agent-id] [message]"
    echo ""
    echo "Examples:"
    echo "  $0 https://my-project.server.staging.mastra.cloud"
    echo "  $0 https://my-project.server.mastra.cloud weather-agent"
    echo "  $0 https://my-project.server.staging.mastra.cloud weather-agent \"What's the weather in Tokyo?\""
    exit 1
fi

# Remove trailing slash if present
SERVER_URL="${SERVER_URL%/}"

echo "=== Testing Mastra Server ==="
echo "Server URL: $SERVER_URL"
echo "Agent ID:   $AGENT_ID"
echo "Message:    $MESSAGE"
echo ""

# Test health endpoint
echo "--- Health Check ---"
HEALTH_RESPONSE=$(curl -sS --connect-timeout 10 --max-time 30 -w "\n%{http_code}" "$SERVER_URL/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n 1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check passed: $HEALTH_BODY"
else
    echo "❌ Health check failed (HTTP $HEALTH_STATUS): $HEALTH_BODY"
    exit 1
fi
echo ""

# Test agent endpoint
echo "--- Agent Test ---"
echo "Calling $AGENT_ID with: \"$MESSAGE\""
echo ""

# Use jq for safe JSON construction (handles special characters in MESSAGE)
JSON_BODY=$(jq -n --arg msg "$MESSAGE" '{"messages":[{"role":"user","content":$msg}]}')
RESPONSE=$(curl -sS --connect-timeout 10 --max-time 60 -w "\n%{http_code}" \
    -X POST "$SERVER_URL/api/agents/$AGENT_ID/generate" \
    -H "Content-Type: application/json" \
    -d "$JSON_BODY")

# Parse response and status (status is always last line)
STATUS=$(printf '%s\n' "$RESPONSE" | tail -n 1)
BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')

if [ "$STATUS" = "200" ]; then
    echo "✅ Agent response (HTTP $STATUS):"
    echo "$BODY" | jq -r '.text // .content // .' 2>/dev/null || echo "$BODY"
else
    echo "❌ Agent call failed (HTTP $STATUS):"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

echo ""
echo "=== Test Complete ==="
