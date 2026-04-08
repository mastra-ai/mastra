# API Testing (`--test api`)

## Purpose

Test all OpenAI-compatible API endpoints.

## Prerequisites

- `MASTRA_API_KEY` set
- `API_URL` set

## Quick Run

Run all API tests at once (from skill directory):

```bash
./.claude/skills/platform-smoke-test/scripts/test-api.sh "$API_URL" "$MASTRA_API_KEY"
```

Or run individual tests manually below.

## Steps

### 1. Chat Completions (Primary)

```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hello!"}]}'
```

- [ ] Returns 200 OK
- [ ] Response includes completion text

### 2. Provider Prefix Validation

```bash
# Test without provider prefix
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello!"}]}'
```

- [ ] Note the response (error or auto-attached provider)

### 3. With Thread ID

```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: test-thread-$(date +%s)" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Remember: my name is Alex"}]}'
```

- [ ] Returns 200 OK
- [ ] Thread is created (verify in dashboard later)

### 4. With Thread ID and Resource ID

```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: test-thread-123" \
  -H "x-resource-id: user-456" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hello!"}]}'
```

- [ ] Returns 200 OK
- [ ] Both headers accepted

### 5. Legacy Completions Endpoint

```bash
curl -X POST "$API_URL/v1/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "prompt": "Say hello"}'
```

- [ ] Note result

### 6. Responses Endpoint

```bash
curl -X POST "$API_URL/v1/responses" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "input": "What is 2+2?"}'
```

- [ ] Returns 200 OK

### 7. Multiple API Keys

1. Navigate to Dashboard → Project → API Keys
2. Click "Create API Key"
3. Copy the new key: `export SECOND_API_KEY="msk_..."`
4. Test both keys:

```bash
# Test original key
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Key 1"}]}'

# Test new key
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $SECOND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Key 2"}]}'
```

- [ ] Both keys return 200 OK

## Observations to Report

| Check            | What to Record                                          |
| ---------------- | ------------------------------------------------------- |
| Chat completions | Record status code and response content                 |
| Without prefix   | Note behavior (error or auto-attach)                    |
| With thread ID   | Record status code, note if thread appears in dashboard |
| Multiple keys    | Record if both keys return responses                    |

## Common Issues

| Issue               | Cause           | Fix                        |
| ------------------- | --------------- | -------------------------- |
| 401 Unauthorized    | Invalid API key | Check key is correct       |
| "No provider found" | Missing prefix  | Use `openai/gpt-4o` format |
| Timeout             | Cold start      | Retry after 30s            |
