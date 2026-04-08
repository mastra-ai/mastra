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
- [ ] Record the error message displayed (note if stack trace or user-friendly)

### 2. Test Tool Error Handling

- [ ] Navigate to `/tools`
- [ ] Select a tool
- [ ] Submit with invalid input:
  - Empty required fields
  - Wrong data type (text for number field)
  - Invalid format
- [ ] Record the error message displayed

### 3. Test API Error Handling (Cloud)

For `--env staging` or `--env production`:

> Replace `<server-url>` with your environment URL, `<agent-id>` with an agent from your setup, and `<your-api-key>` from the platform dashboard.

```bash
# Invalid agent
curl -X POST <server-url>/api/agents/nonexistent-agent/generate \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# Invalid JSON
curl -X POST <server-url>/api/agents/<agent-id>/generate \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d 'not valid json'

# Missing required fields
curl -X POST <server-url>/api/agents/<agent-id>/generate \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

- [ ] Record HTTP status codes returned
- [ ] Record error message content
- [ ] Note if stack traces appear in response

### 4. Test Navigation Errors

- [ ] Navigate to invalid route: `/nonexistent-page`
- [ ] Record what page/behavior appears
- [ ] Navigate to invalid agent: `/agents/fake-agent-id`
- [ ] Record the error handling behavior

### 5. Test Network Error Recovery

- [ ] Start a long-running operation
- [ ] Briefly disconnect network (if possible)
- [ ] Record error-handling behavior
- [ ] Note if retry or recovery options appear

## Observations to Report

| Check          | What to Record                                |
| -------------- | --------------------------------------------- |
| Agent errors   | Error message text, whether stack trace shown |
| Tool errors    | Validation message content                    |
| API errors     | HTTP status codes, error message content      |
| 404 pages      | Page behavior and content                     |
| Network errors | Error handling behavior                       |

## Error Message Quality

Note these aspects of error messages:

- Explain what went wrong
- Suggest how to fix it
- Not expose internal details
- Be readable by non-developers

**Bad**: `TypeError: Cannot read property 'x' of undefined`
**Good**: `Unable to process your request. Please try again.`

## Common Issues

| Issue             | Cause                 | Fix                    |
| ----------------- | --------------------- | ---------------------- |
| Stack trace shown | Error not caught      | Add error boundary     |
| Generic "Error"   | Missing error message | Improve error handling |
| Page crashes      | Unhandled exception   | Check error boundaries |

## Browser Actions

```text
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
