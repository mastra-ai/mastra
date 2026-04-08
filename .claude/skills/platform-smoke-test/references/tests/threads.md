# Threads Testing (`--test threads`)

## Purpose
Test thread CRUD operations.

## Prerequisites
- `MASTRA_API_KEY` set
- `API_URL` set
- A thread created (from memory test or new)

## Steps

### 1. Create a Thread (if needed)
```bash
THREAD_ID="thread-test-$(date +%s)"
export THREAD_ID

curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hello, this creates a thread"}]}'
```

### 2. List Threads
```bash
curl -X GET "$API_URL/v1/threads" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK
- [ ] Response is array of threads
- [ ] Recent thread appears in list

### 3. Get Thread by ID
```bash
curl -X GET "$API_URL/v1/threads/$THREAD_ID" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK
- [ ] Thread details returned
- [ ] Thread ID matches

### 4. Get Messages by Thread ID
```bash
curl -X GET "$API_URL/v1/threads/$THREAD_ID/messages" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK
- [ ] Messages array returned
- [ ] Messages match what was sent

### 5. Get Messages by Resource ID
First, create a message with resource ID:
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: resource-test-thread" \
  -H "x-resource-id: user-test-123" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Test with resource"}]}'

# Then query by resource ID
curl -X GET "$API_URL/v1/messages?resourceId=user-test-123" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK
- [ ] Messages for that resource returned

### 6. Delete Thread
```bash
curl -X DELETE "$API_URL/v1/threads/$THREAD_ID" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK or 204 No Content
- [ ] Thread no longer appears in list

## Expected Results

| Check | Expected |
|-------|----------|
| List threads | Array of threads |
| Get thread | Thread details |
| Get messages | Messages array |
| By resource ID | Filtered messages |
| Delete | Thread removed |

## API Status Note

**These endpoints may return 404 if not yet implemented.** The Thread API is evolving.

If you get 404s on all thread endpoints:
1. Verify threads work in the **Dashboard UI** (Threads page)
2. Report as: "Thread API: ❌ - All endpoints return 404, but Dashboard shows threads"
3. This indicates the REST API isn't exposed yet, not that threading is broken

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 404 on all endpoints | API not exposed | Check Dashboard UI instead, report as "API not available" |
| 404 on specific thread | Thread doesn't exist | Create thread first |
| Empty list | No threads for project | Create some first |
| 404 on messages | Thread ID wrong | Check exact ID |
