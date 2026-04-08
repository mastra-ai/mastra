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

**What to look for:**
- Early messages (1-3): prompt_tokens should be small (~100-500)
- Later messages (10-12): prompt_tokens should NOT be 10x higher
- If message 12 has 10,000+ prompt_tokens, OM may not be working

**Verification:**
- [ ] Check prompt_tokens stays reasonable (NOT growing to 100k+)
- [ ] Completion_tokens are consistent
- [ ] Note any unusually high token counts

### 2. Token Usage Analysis
After extended conversation:

1. Navigate to Dashboard → Project → Logs
2. Find requests from the test thread (filter by thread ID if possible)
3. Click on individual log entries to see token breakdown

**What success looks like:**
- `prompt_tokens`: Should plateau or grow slowly after OM kicks in
- `completion_tokens`: Relatively consistent per response
- `cache_write_tokens` / `cache_read_tokens`: May appear if caching enabled

**Verification:**
- [ ] Verify prompt_tokens for later messages aren't dramatically higher
- [ ] Check token counts match actual content size
- [ ] Verify cache tokens displayed correctly (if present)

### 3. OM Token Tracking in Usage
1. Navigate to Dashboard → Project → Usage
2. Look for "Observational Memory" or "OM Tokens" section

**What success looks like:**
- Separate line item or chart for OM token usage
- OM tokens should be non-zero after running the test
- Total should roughly correlate with conversation length

**If you don't see OM metrics:**
- OM may not be enabled for the project
- Check Settings (Step 4) to verify OM is on

**Verification:**
- [ ] OM tokens tracked separately from inference tokens
- [ ] OM token count makes sense for conversation length
- [ ] Usage charts render correctly with OM data

### 4. OM Threshold Settings
1. Navigate to Dashboard → Project → Settings
2. Look for "Observational Memory" or "Memory" section

**What to look for:**
- Toggle or checkbox to enable/disable OM
- Threshold settings (may be labeled "Token Threshold" or similar)
- Default values are typically 1000-4000 tokens

**If settings aren't visible:**
- OM settings may be in a different location
- Feature may not be fully rolled out
- Note this as "OM Settings: Not found in Settings page"

**Verification:**
- [ ] OM Threshold settings displayed (or note if missing)
- [ ] Default threshold values shown (or note if missing)
- [ ] (Optional) Modify thresholds and verify behavior changes

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

**Note:** If Anthropic isn't attached to your project, this will fail with a provider error. That's expected - just test with OpenAI.

**Verification:**
- [ ] Both models access shared thread context (or note if second provider unavailable)
- [ ] Token counts reasonable for both providers
- [ ] Logs show both requests with correct tracking

## Expected Results

| Check | Expected |
|-------|----------|
| Extended conversation | prompt_tokens plateaus, doesn't grow 10x |
| Logs page | Shows token breakdown per request |
| Usage page | OM tokens shown as separate metric |
| Settings | OM threshold configurable (or note if missing) |
| Multi-model | Same thread works across providers |

## What to Report

**If OM appears to work:**
- "OM: ✅ - prompt_tokens stayed under X for 12 messages"

**If OM appears broken:**
- "OM: ❌ - prompt_tokens grew from 200 to 15,000 over 12 messages"

**If OM UI is missing:**
- "OM: ⚠️ - API works but no OM metrics in Usage dashboard"

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| prompt_tokens grows unboundedly | OM not enabled | Check project settings |
| No OM section in Usage | UI not implemented | Note as missing, not broken |
| Multi-model fails | Provider not attached | Add provider in project settings |
| Settings page empty | Feature not rolled out | Note as "settings not found" |
