# BYOK Testing (`--test byok`)

## Purpose
Test Bring Your Own Key functionality.

## Prerequisites
- `MASTRA_API_KEY` set
- `API_URL` set
- Your own API keys for providers:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY` (optional)
  - `GOOGLE_API_KEY` (optional)

## Steps

### 1. BYOK via HTTP Header - OpenAI
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-openai-api-key: $OPENAI_API_KEY" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hello via BYOK"}]}'
```
- [ ] Returns 200 OK
- [ ] Response includes `"is_byok": true`

### 2. BYOK via HTTP Header - Anthropic
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-anthropic-api-key: $ANTHROPIC_API_KEY" \
  -d '{"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Hello via BYOK"}]}'
```
- [ ] Returns 200 OK
- [ ] Response includes `"is_byok": true`

### 3. BYOK via HTTP Header - Google
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-google-api-key: $GOOGLE_API_KEY" \
  -d '{"model": "google/gemini-1.5-pro", "messages": [{"role": "user", "content": "Hello via BYOK"}]}'
```
- [ ] Returns 200 OK
- [ ] Response includes `"is_byok": true`

### 4. BYOK via Project Settings
1. Navigate to Dashboard → Project → API Keys
2. Under "Providers", add API key for OpenAI
3. Save settings
4. Make request WITHOUT header:

```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hello via settings BYOK"}]}'
```
- [ ] Returns 200 OK
- [ ] Uses your configured key (check `is_byok` in response)

### 5. Verify Usage Not Charged
1. Navigate to Dashboard → Usage
2. Check that BYOK requests show $0 cost
3. [ ] BYOK requests don't consume credits

## Supported Headers

| Provider | Header |
|----------|--------|
| OpenAI | `x-openai-api-key` |
| Anthropic | `x-anthropic-api-key` |
| Google | `x-google-api-key` |

## Expected Results

| Check | Expected |
|-------|----------|
| OpenAI BYOK | `is_byok: true` |
| Anthropic BYOK | `is_byok: true` |
| Google BYOK | `is_byok: true` |
| Settings BYOK | Uses configured key |
| Usage | No charge for BYOK |

## How to Verify BYOK is Working

The `is_byok` field in responses is the primary indicator, but if it shows `false`:

1. **Check Usage/Billing**: BYOK requests should show $0.00 cost
2. **Check Logs**: Look for "BYOK" or "user key" indicator in request details
3. **Check that request succeeded**: If your key works and returns a response, BYOK is likely working even if `is_byok` isn't in the response

**If `is_byok: false` but request works:**
- Report as: "BYOK: ⚠️ - Request succeeds with user key but `is_byok: false` in response"
- This may be a response format issue, not a BYOK failure

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 from provider | Invalid API key | Check your key is valid |
| `is_byok: false` | Response format issue | Check Usage for $0 cost to verify |
| Settings not working | Save not clicked | Save and retry |
| Wrong model error | Provider mismatch | Use matching provider/model |

## Notes

- BYOK bypasses platform API quota
- Usage is still tracked but not charged
- Provider rate limits still apply
- The `is_byok` field may not be present in all response formats
