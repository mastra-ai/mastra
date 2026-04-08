# Observational Memory Testing (`--test om`)

## Purpose
Test Observational Memory (OM) features - Observer, Reflector, and token tracking.

## Prerequisites
- `MASTRA_API_KEY` set
- `API_URL` set
- Dashboard access

## Time Estimate
~45 seconds for Step 1 (12 messages × 2s sleep + API time), ~5 minutes total.

## How OM Works
- OM extracts key facts from conversations to avoid re-sending full history
- Triggers based on **token thresholds**, not message count (but 5+ messages typically reaches threshold)
- OM tokens appear as a separate metric in Usage dashboard
- Without OM, prompt_tokens would grow linearly with conversation length

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

### 7. Token Explosion Test
Test with a long-running conversation to check for unbounded token growth:

```bash
THREAD_ID="om-explosion-$(date +%s)"

# Send 25+ messages to trigger potential issues
for i in {1..25}; do
  RESPONSE=$(curl -s -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -H "x-thread-id: $THREAD_ID" \
    -d "{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"Message $i: Research topic $i in depth and provide detailed analysis\"}]}")
  
  PROMPT_TOKENS=$(echo $RESPONSE | jq '.usage.prompt_tokens // "error"')
  CACHE_READ=$(echo $RESPONSE | jq '.usage.cache_read_tokens // 0')
  ERROR=$(echo $RESPONSE | jq '.error // empty')
  
  echo "Msg $i: prompt=$PROMPT_TOKENS cache_read=$CACHE_READ"
  
  if [ -n "$ERROR" ]; then
    echo "Error at message $i: $ERROR"
    break
  fi
  
  sleep 2
done
```

**Verification:**
- [ ] Note prompt_tokens progression across all messages
- [ ] Note any sudden jumps in token counts
- [ ] Note cache_read_tokens behavior
- [ ] Note any errors encountered
- [ ] Check Logs page for full token breakdown

### 8. Local + Gateway OM Test
Test behavior when using a local Mastra project with OM configured against the gateway:

> **Note:** This test requires a local Mastra project. See `mastra-smoke-test` skill for project setup.

1. Create a local Mastra project with OM configured in agent
2. Configure agent to use gateway as model provider (`mastra/openai/gpt-4o`)
3. Run extended conversation through the agent
4. Compare behavior to direct gateway API calls

**Verification:**
- [ ] Note if token counts differ from direct API calls
- [ ] Note any message duplication in thread
- [ ] Note any errors about message length
- [ ] Check Logs page for actual vs expected message counts

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
| Settings | Whether OM thresholds are displayed |
| Multi-model | Whether context persists across providers |
| Flood test | Success/failure counts, any buffering behavior |
| Token explosion | Token progression across 25 messages, any errors |
| Local + Gateway | Comparison to direct API behavior |
