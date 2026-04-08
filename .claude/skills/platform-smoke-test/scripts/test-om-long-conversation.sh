#!/bin/bash
# OM Long Conversation Test - 30 detailed prompts to build token count
# Usage: ./test-om-long-conversation.sh [api-url] [api-key]
#
# This test generates ~25k tokens over 30 messages.
# Note: This stays BELOW the 30k OM threshold, so OM won't activate.
# Use this to test basic long conversation handling.

set -o pipefail

# Temp file with cleanup trap
RESP_FILE="$(mktemp -t om-long-response.XXXXXX)"
trap 'rm -f "$RESP_FILE"' EXIT

# Preflight checks
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed"; exit 1; }

API_URL="${1:-${API_URL:-https://server.mastra.ai}}"
API_KEY="${2:-$MASTRA_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "Error: API key required. Pass as second argument or set MASTRA_API_KEY"
  exit 1
fi

THREAD_ID="om-long-$(date +%s)-$$-$RANDOM"

# 30 prompts designed to generate long responses (~500-1000 tokens each)
PROMPTS=(
  "Write a comprehensive 500-word essay about the history of computing from Babbage to modern day"
  "Expand on the contributions of Turing, Lovelace, and von Neumann with specific technical details"
  "Explain in detail how transistors work and how they led to integrated circuits and modern CPUs"
  "Describe the evolution from mainframes to personal computers, including key dates and companies"
  "Write detailed pseudocode for quicksort and mergesort, explaining the time complexity of each step"
  "Compare and contrast 5 different programming paradigms with code examples for each"
  "Explain how the internet works from DNS resolution through TCP/IP to HTTP responses"
  "Describe microservices architecture patterns including saga, CQRS, and event sourcing"
  "Write a technical explanation of how neural networks learn through backpropagation"
  "Explain database indexing strategies including B-trees, hash indexes, and bitmap indexes"
  "Describe containerization internals - namespaces, cgroups, and how Docker uses them"
  "Explain the CAP theorem and its practical implications for distributed database design"
  "Write about compiler design phases from lexical analysis through code generation"
  "Describe garbage collection algorithms including mark-sweep, generational, and concurrent GC"
  "Explain consensus algorithms like Raft and Paxos with state machine examples"
  "Write a detailed explanation of how HTTPS and TLS handshakes work"
  "Describe the internals of a modern JavaScript engine like V8"
  "Explain how operating system schedulers work with different scheduling algorithms"
  "Write about memory management in systems programming - stack, heap, and virtual memory"
  "Describe how load balancers work and different load balancing strategies"
  "Explain event-driven architecture and message queue systems like Kafka"
  "Write about API design best practices including REST, GraphQL, and gRPC tradeoffs"
  "Describe how search engines index and rank web pages"
  "Explain distributed tracing and observability in microservices"
  "Write about authentication protocols including OAuth2, OIDC, and SAML"
  "Describe how CDNs work and edge computing architectures"
  "Explain functional programming concepts including monads, functors, and applicatives"
  "Write about real-time systems and the challenges of low-latency computing"
  "Describe how version control systems like Git work internally"
  "Explain WebSocket protocol and real-time bidirectional communication"
)

echo "OM Long Conversation Test"
echo "========================="
echo "API URL: $API_URL"
echo "Thread ID: $THREAD_ID"
echo "Sending ${#PROMPTS[@]} detailed prompts..."
echo ""

TOTAL_PROMPT_TOKENS=0
TOTAL_COMPLETION_TOKENS=0
MESSAGES_SENT=0
FAILED=0

for i in "${!PROMPTS[@]}"; do
  MSG_NUM=$((i + 1))
  PROMPT="${PROMPTS[$i]}"
  
  # Safely encode prompt as JSON string
  JSON_PROMPT=$(printf '%s' "$PROMPT" | jq -Rs .)
  
  if ! HTTP_CODE=$(curl -s -w '%{http_code}' -o "$RESP_FILE" --connect-timeout 10 --max-time 120 \
    -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -H "x-thread-id: $THREAD_ID" \
    -d "{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": $JSON_PROMPT}]}"); then
    echo "ERROR at message $MSG_NUM: curl request failed"
    FAILED=1
    break
  fi
  RESPONSE=$(cat "$RESP_FILE")
  
  if [ "$HTTP_CODE" -ge 400 ]; then
    echo "ERROR at message $MSG_NUM: HTTP $HTTP_CODE"
    FAILED=1
    break
  fi
  
  PROMPT_TOKENS=$(echo "$RESPONSE" | jq -r '.usage.prompt_tokens // 0') || { echo "ERROR at message $MSG_NUM: invalid JSON"; FAILED=1; break; }
  COMPLETION_TOKENS=$(echo "$RESPONSE" | jq -r '.usage.completion_tokens // 0') || { echo "ERROR at message $MSG_NUM: invalid JSON"; FAILED=1; break; }
  CACHE_READ=$(echo "$RESPONSE" | jq '.usage.cache_read_tokens // 0')
  CACHE_WRITE=$(echo "$RESPONSE" | jq '.usage.cache_creation_input_tokens // 0')
  
  echo "Msg $MSG_NUM/${#PROMPTS[@]}: prompt=$PROMPT_TOKENS completion=$COMPLETION_TOKENS cache_read=$CACHE_READ cache_write=$CACHE_WRITE"
  
  # Track totals
  TOTAL_PROMPT_TOKENS=$((TOTAL_PROMPT_TOKENS + PROMPT_TOKENS))
  TOTAL_COMPLETION_TOKENS=$((TOTAL_COMPLETION_TOKENS + COMPLETION_TOKENS))
  
  # Check for errors
  ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty')
  if [ -n "$ERROR" ]; then
    echo "ERROR at message $MSG_NUM: $ERROR"
    FAILED=1
    break
  fi
  
  MESSAGES_SENT=$((MESSAGES_SENT + 1))
  sleep 1
done

echo ""
echo "Summary"
echo "======="
echo "Messages sent: $MESSAGES_SENT/${#PROMPTS[@]}"
echo "Total prompt_tokens: $TOTAL_PROMPT_TOKENS"
echo "Final prompt_tokens: $PROMPT_TOKENS"
echo "Total completion_tokens: $TOTAL_COMPLETION_TOKENS"
echo "Thread ID for dashboard verification: $THREAD_ID"
echo ""
echo "Note: If prompt_tokens < 30k, OM threshold was not reached."

if [ "$FAILED" -eq 1 ]; then
  exit 1
fi
