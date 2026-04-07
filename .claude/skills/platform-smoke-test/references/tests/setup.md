# Platform Setup

## Purpose
Set up environment and authentication for platform testing.

## Steps

### 1. Set Environment URLs
```bash
# Production
export GATEWAY_URL="https://gateway.mastra.ai"
export API_URL="https://server.mastra.ai"

# Staging
export GATEWAY_URL="https://gateway.staging.mastra.ai"
export API_URL="https://server.staging.mastra.ai"
```

### 2. Get API Key

**Option A: Use Existing Key (`--api-key`)**
```bash
export MASTRA_API_KEY="msk_..."
```
- [ ] Set the key
- [ ] Skip to API testing

**Option B: Create New Account (Test Onboarding)**
1. [ ] Navigate to `$GATEWAY_URL` in browser
2. [ ] Click "Sign up" / "Get started"
3. [ ] Complete registration (Google SSO or email)
4. [ ] Verify org and project created
5. [ ] Copy the generated API key immediately
6. [ ] Set: `export MASTRA_API_KEY="msk_..."`

### 3. Verify Authentication
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hi"}]}'
```
- [ ] Returns 200 OK
- [ ] Response includes completion

## Expected Results

| Check | Expected |
|-------|----------|
| Env vars set | `echo $GATEWAY_URL` returns URL |
| API key set | `echo $MASTRA_API_KEY` returns key |
| Auth works | Test request returns 200 |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 on test request | Invalid/expired key | Get new key from dashboard |
| Can't access dashboard | Wrong environment | Check URL matches `--env` |
| No API key shown | Onboarding incomplete | Complete signup flow |
