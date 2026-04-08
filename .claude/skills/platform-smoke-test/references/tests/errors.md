# Error Handling Testing (`--test errors`)

## Purpose
Test error scenarios and verify they're handled correctly.

## Prerequisites
- `MASTRA_API_KEY` set
- `API_URL` set
- Dashboard access

## Steps

### 1. Invalid API Key
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer invalid-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Test"}]}'
```
- [ ] Returns 401 Unauthorized
- [ ] Error message is clear

### 2. Invalid Model
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "invalid-model-name", "messages": [{"role": "user", "content": "Test"}]}'
```
- [ ] Returns error (4xx)
- [ ] Message indicates invalid model

### 3. Missing Provider Prefix
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Test"}]}'
```
- [ ] Returns error about missing provider
- [ ] OR succeeds if auto-attach works (note which)

### 4. Malformed JSON
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d 'not valid json'
```
- [ ] Returns 400 Bad Request
- [ ] Error indicates JSON parsing failed

### 5. Missing Required Fields
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```
- [ ] Returns 400 Bad Request
- [ ] Error indicates missing fields

### 6. Rate Limit Testing (Optional)
```bash
for i in {1..20}; do
  curl -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Test '$i'"}]}' &
done
wait
```
- [ ] Some requests may return 429 Too Many Requests
- [ ] Rate limit headers present

### 7. Verify Errors in Dashboard
After generating errors:

1. Navigate to Dashboard → Logs
2. [ ] 401 errors appear for invalid API key
3. [ ] Model errors are logged
4. [ ] Rate limit errors (429) appear if triggered
5. [ ] Error details expand correctly

**Known Issue**: If errors don't appear in logs, note as potential logging issue.

## Observations to Report

| Error Type | What to Record |
|------------|----------------|
| Invalid key | Record status code returned, note if appears in logs |
| Invalid model | Record status code and error message |
| Bad JSON | Record status code and error message |
| Rate limit | Record status code, note if appears in logs |

## Error Response Quality

Note these aspects of error responses:
- Record the HTTP status code
- Record the error message content
- Note if internal details are exposed
- Note if response is parseable JSON

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 500 instead of 4xx | Unhandled error | Note for team |
| No error in logs | Logging issue | Note for team |
| Stack trace in response | Error not caught | Security issue - report |
