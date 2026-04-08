# Threads Testing (`--test threads`)

## Purpose
Test thread CRUD operations via the Memory API.

## Prerequisites
- `MASTRA_API_KEY` set
- `API_URL` set (e.g., `https://server.mastra.ai`)
- A thread created (from memory test or new)

## Important: API Path
Thread operations use the `/v1/memory/` prefix, NOT `/v1/threads`.

## Steps

### 1. Create a Thread via API
```bash
THREAD_ID="thread-test-$(date +%s)"
RESOURCE_ID="user-$(date +%s)"
export THREAD_ID RESOURCE_ID

curl -X POST "$API_URL/v1/memory/threads" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$THREAD_ID\", \"resourceId\": \"$RESOURCE_ID\", \"title\": \"Test thread\"}"
```
- [ ] Returns 201 Created
- [ ] Response contains thread object with matching ID

> **Note:** `resourceId` is required for thread creation.

Alternative: Create thread implicitly via chat:
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
```

### 2. List Threads
```bash
curl -X GET "$API_URL/v1/memory/threads" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK
- [ ] Response has `threads` array and `total` count
- [ ] Recent thread appears in list

### 3. Get Thread by ID
```bash
curl -X GET "$API_URL/v1/memory/threads/$THREAD_ID" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK
- [ ] Thread details returned
- [ ] Thread ID matches

### 4. Update Thread
```bash
curl -X PATCH "$API_URL/v1/memory/threads/$THREAD_ID" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated title"}'
```
- [ ] Returns 200 OK
- [ ] Thread title updated

### 5. Get Messages by Thread ID
```bash
curl -X GET "$API_URL/v1/memory/threads/$THREAD_ID/messages" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK
- [ ] Response has `messages` array
- [ ] Messages match what was sent

### 6. Save Messages Directly
```bash
curl -X POST "$API_URL/v1/memory/threads/$THREAD_ID/messages" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Direct save test"}]}'
```
- [ ] Returns 200 OK
- [ ] Messages saved to thread

### 7. List Threads by Resource ID
```bash
# First create a thread with resource ID
curl -X POST "$API_URL/v1/memory/threads" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "resource-thread", "resourceId": "user-123"}'

# Then list by resource
curl -X GET "$API_URL/v1/memory/threads?resourceId=user-123" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK
- [ ] Only threads with that resourceId returned

### 8. Delete Thread
```bash
curl -X DELETE "$API_URL/v1/memory/threads/$THREAD_ID" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```
- [ ] Returns 200 OK or 204 No Content
- [ ] Thread no longer appears in list

## Expected Results

| Check | Expected |
|-------|----------|
| Create thread | 201 with thread object |
| List threads | `{threads: [], total: N}` |
| Get thread | Thread details |
| Update thread | Updated fields |
| Get messages | `{messages: []}` |
| Save messages | 200 OK |
| Filter by resource | Filtered list |
| Delete | Thread removed |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 404 on all endpoints | Using `/v1/threads` instead of `/v1/memory/threads` | Use correct path |
| 404 on get | Thread doesn't exist | Create thread first |
| Empty list | No threads for project | Create some first |
| 401 Unauthorized | Invalid API key | Check `MASTRA_API_KEY` |
