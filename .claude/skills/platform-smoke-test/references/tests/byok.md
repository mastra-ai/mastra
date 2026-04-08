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

| Provider  | Header                |
| --------- | --------------------- |
| OpenAI    | `x-openai-api-key`    |
| Anthropic | `x-anthropic-api-key` |
| Google    | `x-google-api-key`    |

## Observations to Report

| Check          | What to Record                      |
| -------------- | ----------------------------------- |
| OpenAI BYOK    | Record `is_byok` value in response  |
| Anthropic BYOK | Record `is_byok` value in response  |
| Google BYOK    | Record `is_byok` value in response  |
| Settings BYOK  | Note if configured key is used      |
| Usage          | Record cost shown for BYOK requests |

## Common Issues

| Issue                | Cause                 | Fix               |
| -------------------- | --------------------- | ----------------- |
| 401 from provider    | Invalid API key       | Check your key    |
| `is_byok: false`     | Header not recognized | Check header name |
| Settings not working | Save not clicked      | Save and retry    |

## Notes

- BYOK bypasses platform API quota
- Usage is still tracked but not charged
- Provider rate limits still apply
