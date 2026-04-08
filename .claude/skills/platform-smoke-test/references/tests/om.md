# Observational Memory Testing (`--test om`)

## Purpose
Test Observational Memory (OM) features - Observer, Reflector, and token tracking.

## Prerequisites
- `MASTRA_API_KEY` set
- `API_URL` set
- Dashboard access
- For Test 8: A local Mastra project — see `references/tests/local-setup.md`

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
| 7. Long Conversation (30 prompts) | ✅ Required | Run ALL 30 prompts |
| 8. Local + Gateway OM | ✅ **CRITICAL** | Run ALL scenarios (8a-8e) |

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

### 7. Long Conversation Test (30 Prompts)

**Run ALL 30 prompts to completion. Do not stop early unless an error occurs.**

This tests Gateway behavior over a long conversation with ~25k tokens. Note: This does NOT trigger OM (threshold is 30k). Test 8 is required to test OM activation.

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

echo "Starting long conversation test with ${#PROMPTS[@]} detailed prompts"
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
- [ ] Token progression - linear growth is normal at this level
- [ ] Cache behavior (cache_read_tokens)
- [ ] Final prompt_tokens count (likely ~25k, below OM threshold)
- [ ] Any errors

**Note:** This test stays below the 30k OM threshold, so no OM activation is expected. Test 8 is designed to trigger OM.

### 8. Local + Gateway OM Test — CRITICAL, DO NOT SKIP

**Goal: Test local agent + Gateway OM interaction at high token counts.**

This tests what happens when:
1. A local Mastra agent has OM enabled
2. Requests route through Gateway (which also has OM)
3. Conversation reaches ~30k+ tokens (OM activation threshold)

Run ALL scenarios (8a-8f). Do not skip any.

---

#### 8a. Setup

**Read `references/tests/local-setup.md` first.** Follow those instructions to:
1. Create or reuse a local Mastra project
2. Add `memory-agent` (Memory only) and `om-agent` (Memory + OM)
3. Configure Gateway routing in `.env`
4. Start the dev server

**Do not proceed until:**
- [ ] Both agents are visible in local Studio (`http://localhost:4111`)
- [ ] `.env` has `OPENAI_BASE_URL` pointing to Gateway

---

#### 8b. Baseline: Memory Only → Gateway

Test the `memory-agent` (no local OM):

1. Open local Studio (`http://localhost:4111`)
2. Select `memory-agent`
3. Send 10 messages in sequence
4. Check Gateway dashboard:
   - [ ] Note thread appears
   - [ ] Note message count
   - [ ] Note token counts in Logs

**What to record:**
- Token progression
- Whether messages appear correctly in Gateway thread

---

#### 8c. Local OM + Gateway OM (Intensive, 30k+ tokens)

Test the `om-agent` (local OM enabled) with enough tokens to reach and exceed the OM threshold.

**Strategy:** Use detailed prompts + tool calls to accumulate tokens faster.

1. Select `om-agent` in local Studio
2. Send prompts that generate long responses AND use tools:
   - "Read the contents of package.json and explain each dependency"
   - "List all files in src/ and describe what each one does"
   - "Read tsconfig.json and explain each compiler option"
   - "Search for all imports in the codebase and summarize"
   - Ask follow-up questions referencing earlier context
   - Request code analysis, refactoring suggestions, documentation
3. **Monitor token count in Gateway Logs** - aim for 30k+
4. After reaching 30k, send 10 more messages and continue observing

**Check Gateway dashboard:**
- [ ] Note thread state
- [ ] Note message count vs what you sent
- [ ] Note token counts in Logs (before and after 30k)
- [ ] Note cache behavior changes
- [ ] Note any sudden jumps or drops in token counts

**What to record:**
- Token progression (especially around 30k threshold)
- Message count comparison (local vs Gateway)
- Cache behavior changes after threshold
- Any errors ("Message too long", etc.)
- Any changes in response behavior after threshold

---

#### 8d. Full History Replay Test

Test what happens when the client sends full conversation history (simulating stateless replay):

```bash
THREAD_ID="local-replay-$(date +%s)"

# Build up history with 5 messages
for i in {1..5}; do
  curl -s -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -H "x-thread-id: $THREAD_ID" \
    -d "{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"Message $i\"}]}"
  sleep 1
done

# Now send ALL history again (simulating what a local client might do)
curl -s -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "Message 1"},
      {"role": "assistant", "content": "Response 1"},
      {"role": "user", "content": "Message 2"},
      {"role": "assistant", "content": "Response 2"},
      {"role": "user", "content": "Message 3"},
      {"role": "assistant", "content": "Response 3"},
      {"role": "user", "content": "Message 4"},
      {"role": "assistant", "content": "Response 4"},
      {"role": "user", "content": "Message 5"},
      {"role": "assistant", "content": "Response 5"},
      {"role": "user", "content": "Message 6 - new message after full replay"}
    ]
  }'
```

**What to record:**
- [ ] Token count for the full-history request
- [ ] Whether Gateway handled the replay correctly
- [ ] Check thread in dashboard for message count

---

#### 8e. MastraCode Integration Test

Test using `createMastraCode` which has built-in Memory + OM + Gateway support.

**Setup:**
```bash
pnpm add mastracode
```

Create a test script `test-mastracode.ts`:
```typescript
import { createMastraCode } from 'mastracode';

async function test() {
  const { harness } = await createMastraCode({
    cwd: process.cwd(),
  });
  
  // Send multiple messages
  for (let i = 1; i <= 10; i++) {
    console.log(`Sending message ${i}...`);
    const result = await harness.generate({
      messages: [{ role: 'user', content: `Tell me fact ${i} about TypeScript` }],
    });
    console.log(`Response ${i}: ${result.text?.substring(0, 100)}...`);
    console.log(`Tokens: ${JSON.stringify(result.usage)}`);
  }
}

test().catch(console.error);
```

Run:
```bash
npx tsx test-mastracode.ts
```

**What to record:**
- [ ] Token progression across 10 messages
- [ ] Any errors
- [ ] Check Gateway Logs for the requests

---

#### Summary Checklist

- [ ] 8b: Memory-only agent baseline completed
- [ ] 8c: OM agent intensive test (30k+ tokens) completed  
- [ ] 8d: Full history replay test completed
- [ ] 8e: MastraCode integration test completed

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
| Long conversation (30 prompts) | Token progression (~25k), cache behavior |
| 8b: Memory-only baseline | Token progression, thread state |
| 8c: Local OM + Gateway (30k+) | Behavior at threshold, message count, cache changes |
| 8d: Full history replay | How Gateway handles full history send |
| 8e: MastraCode integration | Token progression, Gateway Logs |
