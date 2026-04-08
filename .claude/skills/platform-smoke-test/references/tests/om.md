# Observational Memory Testing (`--test om`)

## Purpose
Test Observational Memory (OM) features - Observer, Reflector, and token tracking.

## Prerequisites
- `MASTRA_API_KEY` set
- `API_URL` set
- Dashboard access
- For Test 8: A local Mastra project (create one if needed)

## Required Tests

**ALL of these tests must be run. Do not skip any unless a hard blocker prevents it.**

| Test | Required | Notes |
|------|----------|-------|
| 1. Extended Conversation | ✅ | Baseline test |
| 2. Token Usage Analysis | ✅ | Dashboard verification |
| 3. OM Token Tracking | ✅ | Usage page check |
| 4. OM Threshold Settings | ✅ | Settings page check |
| 5. Multi-Model OM | ✅ | Cross-provider test |
| 6. Message Buffering (Flood) | ✅ | Concurrency test |
| 7. Token Explosion (Intensive) | ✅ **CRITICAL** | Run ALL 30 prompts |
| 8. Local + Gateway OM | ✅ **CRITICAL** | Set up local project if needed |

**Your job is to:**
1. Run each test to completion
2. Record all token counts and behaviors observed
3. Note any errors, unexpected values, or unusual patterns

## Steps

### 1. Extended Conversation Test
Send 10+ messages to build substantial context:

```bash
THREAD_ID="om-test-$(date +%s)"
export THREAD_ID

for i in {1..12}; do
  RESPONSE=$(curl -s -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -H "x-thread-id: $THREAD_ID" \
    -d "{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"Message $i: Tell me an interesting fact about the number $i\"}]}")
  
  echo "Message $i tokens: $(echo $RESPONSE | jq '.usage')"
  sleep 2
done
```

**What to record:**
- Token counts for messages 1, 6, and 12
- Whether prompt_tokens grows linearly or plateaus
- Any errors or unexpected responses

**Verification:**
- [ ] Record prompt_tokens for early messages (1-3)
- [ ] Record prompt_tokens for later messages (10-12)
- [ ] Note the growth pattern

### 2. Token Usage Analysis
After extended conversation:

1. Navigate to Dashboard → Project → Logs
2. Find requests from the test thread (filter by thread ID if possible)
3. Click on individual log entries to see token breakdown

**What to record:**
- Token breakdown for each request (prompt, completion, cache)
- Whether token fields are displayed correctly

**Verification:**
- [ ] Note prompt_tokens values shown
- [ ] Note completion_tokens values shown  
- [ ] Note cache_write_tokens / cache_read_tokens if present

### 3. OM Token Tracking in Usage
1. Navigate to Dashboard → Project → Usage
2. Look for "Observational Memory" or "OM Tokens" section

**What to record:**
- Whether OM/Memory tokens appear as separate metric
- Token counts shown

**Verification:**
- [ ] Note if "Memory Tokens" or similar appears in Usage
- [ ] Note the token count displayed
- [ ] Note if charts render

### 4. OM Threshold Settings
1. Navigate to Dashboard → Project → Settings
2. Look for "Observational Memory" or "Memory" section

**Verification:**
- [ ] Note if OM Threshold settings are displayed
- [ ] Note default threshold values if shown
- [ ] (Optional) Note behavior after modifying thresholds

### 5. Multi-Model OM Test
Test OM with different providers:

```bash
THREAD_ID="om-multi-$(date +%s)"

# OpenAI
curl -s -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Start a conversation about AI"}]}'

sleep 2

# Anthropic (if available)
curl -s -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Continue the conversation about AI safety"}]}'
```

**Verification:**
- [ ] Note if both models access shared thread context
- [ ] Note token counts for both providers
- [ ] Note if logs show both requests

### 6. Message Buffering Test (Flood Test)
Test gateway behavior under rapid message load:

```bash
THREAD_ID="om-flood-$(date +%s)"

# Send 20 messages rapidly without waiting
for i in {1..20}; do
  curl -s -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -H "x-thread-id: $THREAD_ID" \
    -d "{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"Rapid message $i\"}]}" &
done

# Wait for all background requests
wait
echo "All requests sent"
```

**Verification:**
- [ ] Note how many requests succeed vs fail
- [ ] Note any error messages returned
- [ ] Check Logs page for request order and status
- [ ] Check thread for message integrity

### 7. Token Explosion Test (Intensive) — CRITICAL, DO NOT SKIP

**Run ALL 30 prompts to completion. Do not stop early unless an error occurs.**

This test generates a high-token conversation. Each prompt is designed to produce detailed responses.

```bash
THREAD_ID="om-explosion-$(date +%s)"

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

echo "Starting intensive token explosion test with ${#PROMPTS[@]} detailed prompts"
echo "Thread ID: $THREAD_ID"
echo ""

for i in "${!PROMPTS[@]}"; do
  MSG_NUM=$((i + 1))
  PROMPT="${PROMPTS[$i]}"
  
  RESPONSE=$(curl -s -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -H "x-thread-id: $THREAD_ID" \
    -d "{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"$PROMPT\"}]}")
  
  PROMPT_TOKENS=$(echo $RESPONSE | jq '.usage.prompt_tokens // "error"')
  COMPLETION_TOKENS=$(echo $RESPONSE | jq '.usage.completion_tokens // "error"')
  CACHE_READ=$(echo $RESPONSE | jq '.usage.cache_read_tokens // 0')
  CACHE_WRITE=$(echo $RESPONSE | jq '.usage.cache_creation_input_tokens // 0')
  
  echo "Msg $MSG_NUM: prompt=$PROMPT_TOKENS completion=$COMPLETION_TOKENS cache_read=$CACHE_READ cache_write=$CACHE_WRITE"
  
  # Check for errors
  ERROR=$(echo $RESPONSE | jq '.error // empty')
  if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
    echo "ERROR at message $MSG_NUM: $ERROR"
    break
  fi
  
  sleep 1
done

echo ""
echo "Test complete. Check Logs page for full token breakdown."
```

**What to record:**
- [ ] Token progression - does prompt_tokens grow linearly or plateau?
- [ ] Cache behavior - any sudden drops in cache_read_tokens? (may indicate observations activated)
- [ ] Any "Message too long" errors
- [ ] Final prompt_tokens count
- [ ] Check Settings → OM Thresholds to see if you approached/exceeded them

### 8. Local + Gateway OM Test — CRITICAL, DO NOT SKIP

**This test requires a local Mastra project. If you don't have one, create it as part of this test.**

Test behavior when a local Mastra project with memory routes requests through the Gateway.

**Setup (create if needed):**

1. Create a local Mastra project:
```bash
cd ~/mastra-smoke-tests
pnpx create-mastra@latest local-gateway-test --components agents,tools
cd local-gateway-test
```

2. Configure agent to use Gateway as the model provider. In `src/mastra/agents/index.ts`:
```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

export const gatewayAgent = new Agent({
  name: 'gateway-agent',
  instructions: 'You are a helpful assistant.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
  memory: new Memory(),
});
```

3. Set environment to route through Gateway. In `.env`:
```bash
OPENAI_API_KEY=msk_your_gateway_api_key  # Use your Gateway API key
OPENAI_BASE_URL=https://server.mastra.ai/v1  # Point to Gateway
```

4. Start the local dev server:
```bash
pnpm dev
```

**Test Steps:**

1. Open local Studio (usually `http://localhost:4111`)
2. Chat with the gateway-agent:
   - Send 5+ messages in sequence
   - Record each response and any delays

3. Check Gateway dashboard (`$GATEWAY_URL`):
   - Navigate to Threads page
   - [ ] Note if thread appears from local agent
   - [ ] Note message count in thread

4. Check Gateway Logs:
   - [ ] Note token counts for each request
   - [ ] Note if requests show as coming from local agent

5. Compare to direct API:
   - [ ] Note any differences in token counts
   - [ ] Note any message duplication
   - [ ] Note any "message too long" errors

**Verification:**
- [ ] Record whether Gateway received requests from local agent
- [ ] Record token counts from Gateway Logs
- [ ] Record thread state in Gateway dashboard
- [ ] Note any errors or unexpected behavior

## Observations to Report

For each test, note:
- Token counts (prompt_tokens, completion_tokens, cache_read_tokens, cache_write_tokens)
- Any errors or unexpected responses
- Dashboard UI behavior (Logs, Usage, Settings pages)
- Thread integrity (messages in correct order, no duplicates)

| Test | What to Record |
|------|----------------|
| Extended conversation | Token progression across 12 messages |
| Token usage analysis | Breakdown visible in Logs page |
| OM tracking | Whether "Memory Tokens" appears in Usage |
| Settings | OM threshold values displayed |
| Multi-model | Whether context persists across providers |
| Flood test | Success/failure counts, any buffering behavior |
| Token explosion (30 prompts) | Token progression, cache behavior, any errors |
| Local + Gateway | Gateway Logs token counts, thread state, any unusual behavior |
