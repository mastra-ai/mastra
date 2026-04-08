# Memory Testing (`--test memory`)

## Purpose
Test that memory persists across requests using thread IDs.

## Prerequisites
- `MASTRA_API_KEY` set
- `API_URL` set

## Steps

### 1. Create Thread with Context
```bash
THREAD_ID="memory-test-$(date +%s)"
export THREAD_ID

curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "My favorite color is blue and my name is Alex"}]}'
```
- [ ] Returns 200 OK
- [ ] Acknowledges the information

### 2. Test Recall
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "What is my favorite color and what is my name?"}]}'
```
- [ ] Returns 200 OK
- [ ] Response mentions "blue"
- [ ] Response mentions "Alex"

### 3. Test Without Thread ID
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "What is my name?"}]}'
```
- [ ] Returns 200 OK
- [ ] Response does NOT know the name (no memory)

### 4. Verify in Dashboard
1. Navigate to Dashboard → Threads
2. Find thread: `memory-test-<timestamp>`
3. [ ] Thread appears in list
4. [ ] Click to see message history
5. [ ] Both messages are displayed

## Observations to Report

| Check | What to Record |
|-------|----------------|
| First message | Record status code and response |
| Recall | Note if response mentions "blue" and "Alex" |
| No thread ID | Record what the response says about name |
| Dashboard | Note if thread and messages appear |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| No recall | Thread ID mismatch | Check exact thread ID |
| Thread not in dashboard | Wrong project | Verify API key matches project |
| Empty thread | Messages not saved | Check for errors in Logs |
