# Gateway and Memory Testing

Reference document for testing Gateway and Memory-specific features.

## Related Linear Issues

- **CLOUD-770**: Test that OM memory tokens are taken out of the amount
- **CLOUD-773**: Test basic token usage/credit pool
- **CLOUD-772**: Test BYOK for Anthropic/OpenAI/Google

## Memory Gateway Testing

### Token Usage Verification

When using the Memory Gateway, verify that token usage is correctly tracked:

1. **Before test**: Note current token/credit balance in project settings
2. **Make memory-enabled request**:
   ```bash
   curl -X POST https://gateway.mastra.ai/v1/chat/completions \
     -H "Authorization: Bearer $MASTRA_API_KEY" \
     -H "Content-Type: application/json" \
     -H "x-thread-id: test-thread-123" \
     -d '{
       "model": "gpt-4o",
       "messages": [{"role": "user", "content": "Hello, remember this conversation"}]
     }'
   ```
3. **After test**: Verify token count increased appropriately
4. **Check credit pool**: Confirm credits deducted match token usage

### Memory Persistence

Test that memory persists across requests:

1. Send initial message with `x-thread-id`
2. Send follow-up referencing previous context
3. Verify agent recalls previous conversation

```bash
# First message
curl -X POST https://gateway.mastra.ai/v1/chat/completions \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "x-thread-id: memory-test-123" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "My favorite color is blue"}]}'

# Second message - should remember
curl -X POST https://gateway.mastra.ai/v1/chat/completions \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "x-thread-id: memory-test-123" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "What is my favorite color?"}]}'
```

## BYOK Testing

### Via HTTP Header

Test each provider's BYOK functionality:

#### OpenAI

```bash
curl -X POST https://gateway.mastra.ai/v1/chat/completions \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "x-openai-api-key: sk-your-key" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
```

#### Anthropic

```bash
curl -X POST https://gateway.mastra.ai/v1/chat/completions \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "x-anthropic-api-key: sk-ant-your-key" \
  -d '{"model": "claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Hello"}]}'
```

#### Google

```bash
curl -X POST https://gateway.mastra.ai/v1/chat/completions \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "x-google-api-key: your-google-key" \
  -d '{"model": "gemini-1.5-pro", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Via Project Settings

1. Navigate to Studio → Settings → API Keys
2. Add provider API key under "Provider Keys"
3. Save settings
4. Make a request without the header
5. Verify the request uses the project-configured key (check billing on provider side)

## Verification Checklist

| Test                        | Expected Result                     | Status |
| --------------------------- | ----------------------------------- | ------ |
| Token usage tracking        | Credits deducted match tokens used  | ⬜     |
| Memory persistence          | Agent recalls previous conversation | ⬜     |
| BYOK via header (OpenAI)    | Request succeeds with user's key    | ⬜     |
| BYOK via header (Anthropic) | Request succeeds with user's key    | ⬜     |
| BYOK via header (Google)    | Request succeeds with user's key    | ⬜     |
| BYOK via settings           | Project key used when no header     | ⬜     |

## Troubleshooting

### Token usage not reflecting

- Check if the request went through the Gateway (vs direct to provider)
- Verify `x-thread-id` header is set for memory-enabled requests
- Check project billing settings

### BYOK not working

- Verify header name is correct (`x-openai-api-key`, not `x-api-key`)
- Check if key is valid with direct provider API call
- Ensure no trailing whitespace in key value
