# Observational Memory Testing (`--test om`)

## Purpose
Test Observational Memory (OM) features - Observer, Reflector, and token tracking.

## Prerequisites
- `MASTRA_API_KEY` set
- `API_URL` set
- Dashboard access

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

**Verification:**
- [ ] Check prompt_tokens stays reasonable (NOT growing to 100k+)
- [ ] Completion_tokens are consistent
- [ ] Note any unusually high token counts

### 2. Token Usage Analysis
After extended conversation:

1. Navigate to Dashboard → Project → Logs
2. Find requests from the test thread
3. [ ] Verify prompt_tokens for later messages aren't dramatically higher
4. [ ] Check token counts match actual content size
5. [ ] Verify cache tokens displayed correctly

### 3. OM Token Tracking in Usage
1. Navigate to Dashboard → Project → Usage
2. [ ] Verify OM tokens tracked separately from inference tokens
3. [ ] OM token count makes sense for conversation length
4. [ ] Usage charts render correctly with OM data

### 4. OM Threshold Settings
1. Navigate to Dashboard → Project → Settings
2. [ ] OM Threshold settings displayed
3. [ ] Default threshold values shown
4. [ ] (Optional) Modify thresholds and verify behavior changes

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

# Anthropic
curl -s -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Continue the conversation about AI safety"}]}'
```

**Verification:**
- [ ] Both models access shared thread context
- [ ] Token counts reasonable for both providers
- [ ] Logs show both requests with correct tracking

## Expected Results

| Check | Expected |
|-------|----------|
| Extended conversation | Tokens stay reasonable |
| Token tracking | OM tokens shown separately |
| Multi-model | Both providers work on same thread |
| Thresholds | Settings accessible |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Very high tokens | OM not working | Check OM is enabled |
| No OM tokens | OM disabled | Check project settings |
| Multi-model fails | Provider not attached | Add provider in settings |

## Notes

- OM processes conversations to extract key information
- Token usage should stabilize after initial context building
- If prompt_tokens grow unboundedly, OM may not be functioning
