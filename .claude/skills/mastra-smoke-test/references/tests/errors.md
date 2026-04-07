# Error Handling Testing (`--test errors`)

## Purpose
Verify the application handles errors gracefully with user-friendly messages.

## Steps

### 1. Test Agent Error Handling
- [ ] Navigate to `/agents`
- [ ] Select an agent
- [ ] Send intentionally problematic input:
  - Empty message
  - Very long message (10000+ chars)
  - Special characters only: `@#$%^&*()`
- [ ] Verify error is user-friendly (not stack trace)

### 2. Test Tool Error Handling
- [ ] Navigate to `/tools`
- [ ] Select a tool
- [ ] Submit with invalid input:
  - Empty required fields
  - Wrong data type (text for number field)
  - Invalid format
- [ ] Verify clear error message displayed

### 3. Test API Error Handling (Cloud)
For `--env staging` or `--env production`:

```bash
# Invalid agent
curl -X POST <server-url>/api/agents/nonexistent-agent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# Invalid JSON
curl -X POST <server-url>/api/agents/weather-agent/generate \
  -H "Content-Type: application/json" \
  -d 'not valid json'

# Missing required fields
curl -X POST <server-url>/api/agents/weather-agent/generate \
  -H "Content-Type: application/json" \
  -d '{}'
```

- [ ] Verify appropriate HTTP error codes
- [ ] Response includes error message
- [ ] No stack traces in response

### 4. Test Navigation Errors
- [ ] Navigate to invalid route: `/nonexistent-page`
- [ ] Verify 404 page or redirect
- [ ] Navigate to invalid agent: `/agents/fake-agent-id`
- [ ] Verify friendly error

### 5. Test Network Error Recovery
- [ ] Start a long-running operation
- [ ] Briefly disconnect network (if possible)
- [ ] Verify graceful error handling
- [ ] Verify retry or recovery options

## Expected Results

| Check | Expected |
|-------|----------|
| Agent errors | User-friendly message, no stack trace |
| Tool errors | Clear validation message |
| API errors | Appropriate HTTP status, error message |
| 404 pages | Clean error page |
| Network errors | Graceful handling |

## Error Message Quality

Good error messages should:
- Explain what went wrong
- Suggest how to fix it
- Not expose internal details
- Be readable by non-developers

**Bad**: `TypeError: Cannot read property 'x' of undefined`
**Good**: `Unable to process your request. Please try again.`

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Stack trace shown | Error not caught | Add error boundary |
| Generic "Error" | Missing error message | Improve error handling |
| Page crashes | Unhandled exception | Check error boundaries |

## Browser Actions

```
# Agent error test
Navigate to: /agents
Click: Select agent
Type: "@#$%^&*()"
Send: Message
Verify: Error is user-friendly

# Tool error test
Navigate to: /tools
Click: Select tool
Clear: All inputs
Click: Submit
Verify: Validation error shown

# 404 test
Navigate to: /this-page-does-not-exist
Verify: 404 or redirect, not crash
```
