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

| Test                              | Required        | Notes                        |
| --------------------------------- | --------------- | ---------------------------- |
| 1. Extended Conversation          | ✅              | Baseline test                |
| 2. Token Usage Analysis           | ✅              | Dashboard verification       |
| 3. OM Token Tracking              | ✅              | Usage page check             |
| 4. OM Threshold Settings          | ✅              | Settings page check          |
| 5. Multi-Model OM                 | ✅              | Cross-provider test          |
| 6. Message Buffering (Flood)      | ✅              | Concurrency test             |
| 7. Long Conversation (30 prompts) | ✅ Required     | Run ALL 30 prompts           |
| 8. Full History Replay            | ✅              | Tests stateless client       |
| 9. Local + Gateway OM             | ✅ **CRITICAL** | Run ALL scenarios (9a-9f)    |

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

Test gateway behavior under rapid message load.

**Run the script:**

```bash
./scripts/test-om-flood.sh "$API_URL" "$MASTRA_API_KEY"
```

The script sends 20 concurrent requests and reports success/failure counts.

**What to record:**

- [ ] How many requests succeed vs fail
- [ ] Any error messages
- [ ] Thread state in dashboard (use thread ID from output)

### 7. Long Conversation Test (30 Prompts)

**Run ALL 30 prompts to completion. Do not stop early unless an error occurs.**

This tests Gateway behavior over a long conversation with ~25k tokens. Note: This does NOT trigger OM (threshold is 30k). Test 8 is required to test OM activation.

**Run the script:**

```bash
./scripts/test-om-long-conversation.sh "$API_URL" "$MASTRA_API_KEY"
```

The script sends 30 detailed prompts and tracks token progression.

**What to record:**

- [ ] Token progression (should show linear growth)
- [ ] Cache behavior (cache_read_tokens)
- [ ] Final prompt_tokens count (likely ~25k, below OM threshold)
- [ ] Any errors

**Note:** This test stays below the 30k OM threshold, so no OM activation is expected. Test 9 is designed to trigger OM.

---

### 8. Full History Replay Test

Test what happens when the client sends full conversation history (simulating stateless replay). This is a pure Gateway test.

**Run the script:**

```bash
./scripts/test-om-history-replay.sh "$API_URL" "$MASTRA_API_KEY"
```

The script:

1. Builds a 5-message conversation
2. Sends ALL history again with one new message
3. Checks thread state for message deduplication

**What to record:**

- [ ] Token count for the full-history request
- [ ] Final message count in Gateway vs expected
- [ ] Whether Gateway handled replay correctly

---

### 9. Local + Gateway OM Test — CRITICAL, DO NOT SKIP

**Goal: Test local agent + Gateway OM interaction at high token counts.**

This tests what happens when:

1. A local Mastra agent has OM enabled
2. Requests route through Gateway (which also has OM)
3. Conversation reaches ~30k+ tokens (OM activation threshold)

Run ALL scenarios (9a-9e). Do not skip any.

---

#### 9a. Setup

**Read `references/tests/local-setup.md` first.** Follow those instructions to:

1. Create or reuse a local Mastra project
2. Add `memory-agent` (Memory only) and `om-agent` (Memory + OM)
3. Configure Gateway routing in `.env`
4. Start the dev server

**Do not proceed until:**

- [ ] Both agents are visible in local Studio (`http://localhost:4111`)
- [ ] `.env` has `OPENAI_BASE_URL` pointing to Gateway

---

#### 9b. Verify Gateway Routing

**Before any other test, verify that local requests actually hit Gateway.**

1. Open Gateway Dashboard → Logs page
2. Note the current number of requests
3. In local Studio, send ONE test message to `memory-agent`: "Hello, this is a routing test"
4. Refresh Gateway Dashboard → Logs page
5. Look for a new request with content containing "routing test"

**Verification:**

- [ ] Note if request appears in Gateway Logs
- [ ] Note if thread was created in Gateway Dashboard → Threads
- [ ] If NO request appears: `.env` is misconfigured — fix before proceeding

**Do not proceed to 9c until Gateway routing is confirmed.**

---

#### 9c. Baseline: Memory Only → Gateway

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

#### 9d. Local OM + Gateway OM (Intensive, 30k+ tokens)

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

#### 9e. MastraCode + Gateway (Intensive)

Test MastraCode routing through Gateway with enough messages to accumulate significant tokens.

**Important:** MastraCode uses its own auth, not the project's `.env`. You must set Gateway env vars:

```bash
export MASTRA_GATEWAY_API_KEY="$MASTRA_API_KEY"
export MASTRA_GATEWAY_URL="$API_URL"
```

**Setup:**

```bash
pnpm add mastracode
```

Create `test-mastracode-gateway.ts`:

```typescript
import { createMastraCode } from 'mastracode';

async function test() {
  console.log('Gateway URL:', process.env.MASTRA_GATEWAY_URL);
  console.log('Gateway Key:', process.env.MASTRA_GATEWAY_API_KEY ? 'set' : 'NOT SET');

  const { harness } = await createMastraCode({
    cwd: process.cwd(),
  });

  await harness.init();

  // Track responses
  harness.subscribe((event) => {
    if (event.type === 'message_update' && event.message.role === 'assistant') {
      const content = event.message.content?.toString() || '';
      console.log(`Response (${content.length} chars): ${content.substring(0, 100)}...`);
    }
  });

  // Send 20 detailed prompts to accumulate tokens
  const prompts = [
    "Explain the history of TypeScript in detail",
    "What are all the TypeScript compiler options and what do they do?",
    "Compare TypeScript to JavaScript with examples",
    "Explain TypeScript generics with complex examples",
    "What are mapped types in TypeScript? Give examples",
    "Explain conditional types in TypeScript",
    "What is type inference in TypeScript?",
    "Explain TypeScript decorators in detail",
    "What are utility types in TypeScript? List all of them",
    "Explain the TypeScript module system",
    "What are declaration files in TypeScript?",
    "Explain strict mode options in TypeScript",
    "What is structural typing in TypeScript?",
    "Explain TypeScript enums with examples",
    "What are type guards in TypeScript?",
    "Explain discriminated unions in TypeScript",
    "What is the 'infer' keyword in TypeScript?",
    "Explain variance in TypeScript generics",
    "What are template literal types?",
    "Summarize everything we discussed about TypeScript",
  ];

  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n[${i + 1}/${prompts.length}] ${prompts[i].substring(0, 50)}...`);
    await harness.sendMessage({ content: prompts[i] });
  }

  console.log('\nDone. Check Gateway Logs for token counts.');
}

test().catch(console.error);
```

Run:

```bash
npx tsx test-mastracode-gateway.ts
```

**Verification:**

- [ ] Note if "Gateway URL" and "Gateway Key" are set in output
- [ ] Note how many messages complete successfully
- [ ] Check Gateway Dashboard → Logs for the requests
- [ ] Note token progression in Gateway Logs
- [ ] Note any errors or unusual behavior

---

#### 9f. History Replay via Local Agent

Test what happens when the local agent sends requests that include conversation history (simulating how some clients replay full history).

This mirrors Test 8 (direct API history replay) but goes through the local project.

**Steps:**

1. In local Studio, select `memory-agent`
2. Have a 5-message conversation:
   - "My name is Alice"
   - "I live in Seattle"
   - "I work as an engineer"
   - "My favorite color is blue"
   - "What do you know about me?"
3. Note the thread ID from Gateway Dashboard
4. Now test replay behavior using curl with the same thread but sending full history:

```bash
THREAD_ID="<thread-id-from-gateway>"

curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "My name is Alice"},
      {"role": "assistant", "content": "Nice to meet you, Alice!"},
      {"role": "user", "content": "I live in Seattle"},
      {"role": "assistant", "content": "Seattle is a great city!"},
      {"role": "user", "content": "What is my name and where do I live?"}
    ]
  }'
```

**What to record:**

- [ ] Note message count in Gateway thread before and after replay
- [ ] Note if Gateway deduplicated the repeated messages
- [ ] Note token count for the replay request
- [ ] Note any differences from Test 8 (direct API replay)

---

#### Summary Checklist

- [ ] 9a: Setup complete, agents visible in local Studio
- [ ] 9b: Gateway routing verified (request appears in Gateway Logs)
- [ ] 9c: Memory-only agent baseline completed
- [ ] 9d: OM agent intensive test (30k+ tokens) completed
- [ ] 9e: MastraCode + Gateway intensive test completed
- [ ] 9f: History replay via local agent completed

## Observations to Report

For each test, note:

- Token counts (prompt_tokens, completion_tokens, cache_read_tokens, cache_write_tokens)
- Any errors or unexpected responses
- Dashboard UI behavior (Logs, Usage, Settings pages)
- Thread integrity (messages in correct order, no duplicates)

| Test                           | What to Record                                       |
| ------------------------------ | ---------------------------------------------------- |
| Extended conversation          | Token progression across 12 messages                 |
| Token usage analysis           | Breakdown visible in Logs page                       |
| OM tracking                    | Whether "Memory Tokens" appears in Usage             |
| Settings                       | OM threshold values displayed                        |
| Multi-model                    | Whether context persists across providers            |
| Flood test                     | Success/failure counts, any buffering behavior       |
| Long conversation (30 prompts) | Token progression (~25k), cache behavior             |
| Full history replay            | How Gateway handles full history send                |
| 9b: Gateway routing            | Whether local requests appear in Gateway Logs        |
| 9c: Memory-only baseline       | Token progression, thread state                      |
| 9d: Local OM + Gateway (30k+)  | Behavior at threshold, message count, cache changes  |
| 9e: MastraCode + Gateway       | Token progression across 20 prompts, Gateway Logs    |
| 9f: History replay via local   | Message deduplication, comparison with Test 8        |
