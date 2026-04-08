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

| Test                              | Required        | Notes                     |
| --------------------------------- | --------------- | ------------------------- |
| 1. Extended Conversation          | ✅              | Baseline test             |
| 2. Token Usage Analysis           | ✅              | Dashboard verification    |
| 3. OM Token Tracking              | ✅              | Usage page check          |
| 4. OM Threshold Settings          | ✅              | Settings page check       |
| 5. Multi-Model OM                 | ✅              | Cross-provider test       |
| 6. Message Buffering (Flood)      | ✅              | Concurrency test          |
| 7. Long Conversation (30 prompts) | ✅ Required     | Run ALL 30 prompts        |
| 8. Full History Replay            | ✅              | Tests stateless client    |
| 9. Local + Gateway OM             | ✅ **CRITICAL** | Run ALL scenarios (9a-9f) |

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

1. Builds a 5-message conversation (5 user + 5 assistant = 10 messages)
2. Sends ALL history again with one new message
3. Checks thread state

**What to record:**

- [ ] Message count BEFORE replay (note the exact number)
- [ ] Message count AFTER replay (note the exact number)
- [ ] If counts differ, note by how much (e.g., "was 10, now 12 = +2 messages")
- [ ] Token count for the full-history request
- [ ] If messages were added, note examples of what was duplicated (e.g., "second copy of 'My name is Alice' appeared")

---

### 9. Local + Gateway OM Test — CRITICAL, DO NOT SKIP

**Goal: Test local agent + Gateway OM interaction at high token counts.**

This tests what happens when:

1. A local Mastra agent has OM enabled
2. Requests route through Gateway (which also has OM)
3. Conversation reaches ~30k+ tokens (OM activation threshold)

Run ALL scenarios (9a-9f). Do not skip any.

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

#### 9e. MastraCode + Gateway (Basic Routing)

Test MastraCode routing through Gateway with 10 simple messages to verify basic functionality.

**Prerequisites:**

Ensure Gateway OM thresholds are at defaults in Dashboard → Settings:

- Observation: 30,000 tokens
- Reflection: 40,000 tokens

**How MastraCode routes to Gateway:**

MastraCode only routes through Gateway when:

1. `MASTRA_GATEWAY_API_KEY` is set, AND
2. The model ID has a `mastra/` prefix (e.g., `mastra/openai/gpt-4o-mini`)

Without the `mastra/` prefix, requests go directly to the provider (OpenAI, Anthropic, etc.).

**Setup:**

Create `test-mastracode-gateway.ts`:

```typescript
import { createMastraCode } from 'mastracode';

// Set Gateway env vars BEFORE calling createMastraCode
process.env.MASTRA_GATEWAY_API_KEY = 'msk_your_key_here'; // Replace with actual key
process.env.MASTRA_GATEWAY_URL = 'https://server.mastra.ai';

async function test() {
  console.log('Creating MastraCode with Gateway routing...');

  const { harness } = await createMastraCode({
    cwd: process.cwd(),
    initialState: {
      currentModelId: 'mastra/openai/gpt-4o-mini', // mastra/ prefix required!
    },
  });

  await harness.init();
  console.log('Harness initialized');

  // Send 10 simple prompts to verify routing and token accumulation
  const prompts = [
    'Explain the history of TypeScript briefly',
    'What are TypeScript generics?',
    'Compare TypeScript to JavaScript',
    'What are mapped types in TypeScript?',
    'Explain conditional types briefly',
    'What is type inference?',
    'Explain TypeScript decorators',
    'List utility types in TypeScript',
    'Explain the module system',
    'Summarize what we discussed',
  ];

  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n[${i + 1}/${prompts.length}] ${prompts[i].substring(0, 50)}...`);
    try {
      await harness.sendMessage({ content: prompts[i] });
      console.log('✓ Response received');
    } catch (err) {
      console.error('✗ Error:', err);
    }
  }

  console.log('\nDone. Check Gateway Dashboard for:');
  console.log('- Thread ID and message count');
  console.log('- Token progression in Logs');
}

test().catch(console.error);
```

**Run:**

```bash
npx tsx test-mastracode-gateway.ts
```

**What to record:**

- [ ] Requests appear in Gateway Dashboard → Logs (confirms Gateway routing)
- [ ] Thread ID from Gateway Dashboard
- [ ] Messages sent (10) vs messages visible in Gateway thread
- [ ] Token progression (note prompt_tokens at message 1, 5, and 10)
- [ ] Thread token indicator values

---

#### 9f. History Replay via Local Agent

Test thread behavior when messages are sent via local Studio, then accessed again.

**Steps:**

1. In local Studio, select `memory-agent`
2. Have a 5-message conversation:
   - "My name is Alice"
   - "I live in Seattle"
   - "I work as an engineer"
   - "My favorite color is blue"
   - "What do you know about me?"
3. Go to Gateway Dashboard → Threads
4. Find the thread created by the local agent
5. Count the messages and note the exact content

**What to record:**

- [ ] Thread ID from Gateway
- [ ] Exact message count in Gateway (e.g., "10 messages: 5 user + 5 assistant")
- [ ] Whether message count matches what you sent (5 user messages should = 5 user + 5 assistant in thread)
- [ ] If counts don't match, note examples (e.g., "sent 5 user messages but thread shows 7 user messages - duplicates of 'My name is Alice' and 'I live in Seattle'")
- [ ] Compare to Test 8 - any differences in how Gateway handled local-origin vs direct-API threads?

---

#### 9g. MastraCode Duplication Bug Test

Test for the double-write bug when MastraCode (with built-in OM) routes through Gateway (with OM).

**Prerequisites:**

1. Lower Gateway OM thresholds in Dashboard → Settings:
   - Observation: 30,000 → **3,000 tokens**
   - Reflection: 40,000 → **4,000 tokens**
2. Note: Remember to restore thresholds after testing

**Setup:**

Create `test-mastracode-duplication.ts`:

```typescript
import { createMastraCode } from 'mastracode';

// Set Gateway env vars BEFORE calling createMastraCode
process.env.MASTRA_GATEWAY_API_KEY = 'msk_your_key_here'; // Replace with actual key
process.env.MASTRA_GATEWAY_URL = 'https://server.mastra.ai';

async function test() {
  console.log('Creating MastraCode with Gateway routing...');
  console.log('NOTE: Ensure Gateway OM thresholds are lowered (3k/4k)');

  const { harness } = await createMastraCode({
    cwd: process.cwd(),
    initialState: {
      currentModelId: 'mastra/openai/gpt-4o-mini', // mastra/ prefix required!
    },
  });

  await harness.init();
  console.log('Harness initialized');

  // 5 tool-heavy prompts to trigger OM quickly
  const prompts = [
    'Read package.json and list all dependencies',
    'Read tsconfig.json completely',
    'List all files in src/ recursively',
    'Read src/mastra/index.ts',
    "Search for 'import' in all .ts files",
  ];

  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n[${i + 1}/${prompts.length}] ${prompts[i]}`);
    try {
      await harness.sendMessage({ content: prompts[i] });
      console.log('✓ Response received');
    } catch (err) {
      console.error('✗ Error:', err);
    }
  }

  console.log('\nDone. Check Gateway Dashboard for:');
  console.log('- Thread ID');
  console.log('- Message count (sent 5 user prompts)');
  console.log('- Note any duplicated assistant responses');
}

test().catch(console.error);
```

**Run:**

```bash
npx tsx test-mastracode-duplication.ts
```

**What to record:**

- [ ] Thread ID from Gateway Dashboard
- [ ] **Message count**: How many total messages in thread (sent 5 user prompts)
- [ ] **Duplicate check**: Note any assistant responses that appear more than once
- [ ] **Timestamp check**: Note timestamps on any duplicated messages
- [ ] Token values at start and end of conversation
- [ ] Whether OM threshold indicator shows activation

**After testing:**

Restore Gateway OM thresholds to defaults (30k/40k) in Dashboard → Settings.

---

#### Summary Checklist

- [ ] 9a: Setup complete, agents visible in local Studio
- [ ] 9b: Gateway routing verified (request appears in Gateway Logs)
- [ ] 9c: Memory-only agent baseline completed
- [ ] 9d: OM agent intensive test (30k+ tokens) completed
- [ ] 9e: MastraCode + Gateway basic routing test completed
- [ ] 9f: History replay via local agent completed
- [ ] 9g: MastraCode duplication bug test completed (note if duplicates found)

## Observations to Report

For each test, note:

- Token counts (prompt_tokens, completion_tokens, cache_read_tokens, cache_write_tokens)
- Any errors or unexpected responses
- Dashboard UI behavior (Logs, Usage, Settings pages)
- Thread integrity (messages in correct order, no duplicates)

| Test                           | What to Record                                      |
| ------------------------------ | --------------------------------------------------- |
| Extended conversation          | Token progression across 12 messages                |
| Token usage analysis           | Breakdown visible in Logs page                      |
| OM tracking                    | Whether "Memory Tokens" appears in Usage            |
| Settings                       | OM threshold values displayed                       |
| Multi-model                    | Whether context persists across providers           |
| Flood test                     | Success/failure counts, any buffering behavior      |
| Long conversation (30 prompts) | Token progression (~25k), cache behavior            |
| Full history replay            | How Gateway handles full history send               |
| 9b: Gateway routing            | Whether local requests appear in Gateway Logs       |
| 9c: Memory-only baseline       | Token progression, thread state                     |
| 9d: Local OM + Gateway (30k+)  | Behavior at threshold, message count, cache changes |
| 9e: MastraCode + Gateway       | Token progression across 10 prompts, routing works  |
| 9f: History replay via local   | Message deduplication, comparison with Test 8       |
| 9g: MastraCode duplication bug | Message count (expected 10), duplicate detection    |
