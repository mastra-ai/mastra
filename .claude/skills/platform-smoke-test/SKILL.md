---
name: platform-smoke-test
description: Smoke test the Mastra Platform - Gateway API, dashboard UI, account management, team invites, RBAC, and usage tracking. Tests gateway.mastra.ai and projects.mastra.ai.
---

# Platform Smoke Test

Smoke test the Mastra Platform - including the Memory Gateway API, dashboard UI, account management, team invites, RBAC, and usage tracking. Tests both the Gateway (`gateway.mastra.ai`) and platform features accessible via `projects.mastra.ai`.

## Usage

```
Test the production gateway with a new account
Test the staging gateway API endpoints
Test gateway memory persistence and OM features
Test gateway BYOK flow with my OpenAI key
```

## Parameters

| Parameter           | Required | Default      | Description                                        |
| ------------------- | -------- | ------------ | -------------------------------------------------- |
| `--env`             | Yes      | -            | Target environment: `staging` or `production`      |
| `--api-key`         | No       | -            | Existing API key (skip account creation if provided) |
| `--test`            | No       | `all`        | Specific test: `api`, `memory`, `om`, `threads`, `byok`, `usage`, `dashboard`, `onboarding`, `account`, `invites`, `rbac`, `errors` |
| `--provider`        | No       | `openai`     | Provider for BYOK testing: `openai`, `anthropic`, `google` |

## Prerequisites

- `curl` and `jq` installed
- Browser tools enabled (for dashboard UI testing)
- For BYOK testing: API keys for the providers being tested
- For new account testing: Email that hasn't been used on Gateway

## Gateway URLs

| Environment | Gateway Dashboard | API Endpoint |
|-------------|-------------------|--------------|
| Production  | `https://gateway.mastra.ai` | `https://server.mastra.ai` |
| Staging     | `https://gateway.staging.mastra.ai` | `https://server.staging.mastra.ai` |

## Execution Steps

### 1. Environment Setup

Set the correct URLs based on `--env`:

```bash
# Production
export GATEWAY_URL="https://gateway.mastra.ai"
export API_URL="https://server.mastra.ai"

# Staging
export GATEWAY_URL="https://gateway.staging.mastra.ai"
export API_URL="https://server.staging.mastra.ai"
```

### 2. Account & API Key Setup

**If `--api-key` provided:**
- Use the provided key
- Skip to API testing

**If no `--api-key` (test onboarding):**
1. Navigate to `$GATEWAY_URL` in browser
2. Click "Sign up" / "Get started"
3. Complete registration (Google SSO or email)
4. Verify org and default project created
5. **Test onboarding state persistence**: Switch browser tabs/windows and return - onboarding should still be visible
6. Verify provider is attached to project (check Project → Settings → Providers)
7. Copy the generated API key
8. **Important**: Note the API key immediately - it may not be shown again

```bash
export MASTRA_API_KEY="msk_..."
```

#### Onboarding State Persistence (`--test onboarding`)

Test that onboarding state survives interruptions:

**Tab Switch Test:**
1. Start onboarding flow (new account or "Create Project")
2. **Before completing**: Switch to another browser tab
3. Wait 5-10 seconds
4. Switch back to the Gateway tab
5. [ ] Verify onboarding modal/flow is still visible
6. [ ] Verify any entered data is preserved

**Window Switch Test:**
1. Start a fresh onboarding flow
2. **Before completing**: Switch to a different macOS/Windows workspace or minimize the browser
3. Return to the browser
4. [ ] Verify onboarding is still in progress
5. [ ] Complete onboarding and verify API key is shown

**Rapid Switch Test:**
1. Start onboarding
2. Rapidly switch tabs/windows multiple times (5-6 times)
3. Return to Gateway
4. [ ] Verify onboarding state is preserved

#### Sign-up Methods Test

1. Navigate to `$GATEWAY_URL`
2. Click "Sign up"
3. [ ] Verify Google SSO option is available
4. [ ] Verify email/password signup option is available
5. [ ] Test both methods work (if testing with new accounts)

#### Curl Command Accessibility

After completing onboarding:
1. [ ] Verify curl command example is shown with your API key
2. [ ] Copy the curl command
3. Navigate away from the page (e.g., to Projects)
4. [ ] Check if there's a way to see the curl command again (Settings? Docs?)
5. [ ] Note if the command includes the correct provider prefix in the model

### 3. API Endpoint Testing (`--test api`)

Test all OpenAI-compatible endpoints:

#### Chat Completions (Primary)

```bash
# Basic request (no memory)
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Important**: Model format is `provider/model` (e.g., `openai/gpt-4o`, `anthropic/claude-sonnet-4-20250514`).

#### Provider Prefix Validation

Test that model requests require the `provider/` prefix:

```bash
# This should FAIL - missing provider prefix
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello!"}]}'
# Expected: Error about missing/invalid provider

# This should SUCCEED - has provider prefix
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hello!"}]}'
# Expected: Successful response
```

#### Multiple API Keys

Test that multiple API keys work for the same project:

1. Navigate to Dashboard → Project → API Keys
2. Click "Create API Key"
3. Copy the new key
4. Test both keys work:

```bash
# Test original key
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Test key 1"}]}'

# Test new key
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $SECOND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Test key 2"}]}'
```

#### With Thread ID (enables memory)

```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: test-thread-$(date +%s)" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Remember: my favorite color is blue"}]
  }'
```

#### With Thread ID and Resource ID

```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: test-thread-123" \
  -H "x-resource-id: user-456" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

#### Completions Endpoint (Legacy)

```bash
curl -X POST "$API_URL/v1/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "prompt": "Say hello"
  }'
```

#### Responses Endpoint

```bash
curl -X POST "$API_URL/v1/responses" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "input": "What is 2+2?"
  }'
```

### 4. Memory Persistence Testing (`--test memory`)

Test that memory persists across requests:

```bash
THREAD_ID="memory-test-$(date +%s)"

# First message - establish context
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "My favorite color is blue and my name is Alex"}]}'

# Second message - test recall
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "What is my favorite color and what is my name?"}]}'
```

**Expected**: Second response should correctly recall "blue" and "Alex".

### 5. Thread Operations (`--test threads`)

#### List Threads

```bash
curl -X GET "$API_URL/v1/threads" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```

#### Get Thread by ID

```bash
curl -X GET "$API_URL/v1/threads/$THREAD_ID" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```

#### Get Messages by Thread ID

```bash
curl -X GET "$API_URL/v1/threads/$THREAD_ID/messages" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```

#### Get Messages by Resource ID

```bash
curl -X GET "$API_URL/v1/messages?resourceId=user-456" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```

#### Delete Thread

```bash
curl -X DELETE "$API_URL/v1/threads/$THREAD_ID" \
  -H "Authorization: Bearer $MASTRA_API_KEY"
```

### 6. Observational Memory Testing (`--test om`)

Test OM features comprehensively to verify Observer, Reflector, and token tracking work correctly.

#### Extended Conversation Test

Send many messages in a single thread to build substantial context and trigger OM processing:

```bash
THREAD_ID="om-extended-$(date +%s)"

# Send 10+ messages to build significant context
for i in {1..12}; do
  RESPONSE=$(curl -s -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -H "x-thread-id: $THREAD_ID" \
    -d "{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"Message $i: Tell me an interesting fact about the number $i\"}]}")
  
  # Extract and log token usage for each message
  echo "Message $i tokens: $(echo $RESPONSE | jq '.usage')"
  sleep 2
done
```

**Verification:**
1. [ ] Check that prompt_tokens stays reasonable (should NOT grow to 100k+)
2. [ ] Verify completion_tokens are consistent
3. [ ] Note if any requests show unusually high token counts

#### Token Usage Analysis

After the extended conversation:
1. Navigate to Dashboard → Project → Logs
2. Find the requests from the test thread
3. [ ] Verify prompt_tokens for later messages aren't dramatically higher than earlier ones
4. [ ] Check that token counts displayed match the actual request content size
5. [ ] Verify cache tokens (cached_tokens, cache_write_tokens) are displayed correctly

#### OM Token Tracking in Usage Dashboard

1. Navigate to Dashboard → Project → Usage
2. [ ] Verify OM tokens are tracked separately from inference tokens
3. [ ] Check that the OM token count makes sense relative to conversation length
4. [ ] Verify usage charts render correctly with OM data

#### OM Threshold Settings

1. Navigate to Dashboard → Project → Settings
2. [ ] Verify OM Threshold settings are displayed
3. [ ] Check default threshold values are shown
4. [ ] (Optional) Modify thresholds and send more messages to verify behavior changes

#### Multi-Model OM Test

Test OM with different providers to verify consistent behavior:

```bash
THREAD_ID="om-multi-model-$(date +%s)"

# OpenAI
curl -s -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Start a conversation about AI"}]}'

sleep 2

# Anthropic (if available)
curl -s -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-thread-id: $THREAD_ID" \
  -d '{"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Continue the conversation about AI safety"}]}'
```

**Verification:**
1. [ ] Both models can access the shared thread context
2. [ ] Token counts are reasonable for both providers
3. [ ] Check Logs for both requests and compare token tracking

### 7. BYOK Testing (`--test byok`)

#### Via HTTP Header

**OpenAI:**
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-openai-api-key: $OPENAI_API_KEY" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
```

**Anthropic:**
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-anthropic-api-key: $ANTHROPIC_API_KEY" \
  -d '{"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Hello"}]}'
```

**Google:**
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-google-api-key: $GOOGLE_API_KEY" \
  -d '{"model": "google/gemini-1.5-pro", "messages": [{"role": "user", "content": "Hello"}]}'
```

#### Via Project Settings

1. Navigate to Dashboard → Project → API Keys
2. Under "Providers", add API key for provider
3. Save settings
4. Make request without header - should use configured key
5. Verify in response: `"is_byok": true`

### 8. Usage & Billing Testing (`--test usage`)

#### Generate Usage

Make requests with different models to generate varied usage:

```bash
# OpenAI
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Test"}]}'

# Anthropic
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Test"}]}'
```

#### Verify in Dashboard

1. Navigate to Dashboard → Project → Usage
2. Verify:
   - Token counts displayed correctly
   - Cost breakdown by model
   - Usage charts show recent activity
   - Model breakdown chart accurate

### 9. Dashboard UI Testing (`--test dashboard`)

Navigate and verify each section:

#### Projects Page
- List of projects displayed
- Can click into project details
- Project URL shown (if deployed)

#### Threads Page
- List of threads displayed
- Can click into thread details
- Messages displayed correctly
- Timeline/flame graph working

#### Logs Page
- [ ] Request logs displayed in table
- [ ] Can filter by date/status
- [ ] Log details expand correctly when clicked

**Token Count Verification:**
1. Find a recent request in the logs
2. Expand the log entry
3. [ ] Verify prompt_tokens is displayed (not just cached_tokens)
4. [ ] Verify completion_tokens is displayed
5. [ ] Verify total_tokens is displayed
6. [ ] Check cache_write_tokens - should not always be 0

**Multi-Provider Logs:**
1. Send requests with different providers (OpenAI, Anthropic)
2. [ ] Verify logs show correct provider for each
3. [ ] Compare token display between providers - should be consistent

#### Usage Page
- Charts render correctly
- Cost tab shows breakdown
- Model breakdown accurate
- Date range selector works

#### Settings Page
- Project settings accessible
- OM thresholds displayed
- API keys section works
- Provider keys configurable

### 10. Account Creation Testing (`--test account`)

Tests new user registration for Gateway:

1. Navigate to `$GATEWAY_URL` in browser
2. Click "Sign up" / "Get started"
3. Complete registration (Google SSO or email)
4. Verify:
   - Org created automatically
   - Default project created
   - API key displayed and can be copied
   - Redirected to dashboard

### 11. Team Invitation Testing (`--test invites`)

Tests team invitation functionality:

1. Navigate to Dashboard → Settings → Team
2. Click "Invite team member"
3. Enter email address for test teammate
4. Send invitation
5. (If possible) Accept invitation from another account
6. Verify invited user can access the project

### 12. RBAC Testing (`--test rbac`)

Tests role-based access control:

#### Viewer Role

1. Invite a team member with "Viewer" role
2. As that user, verify:
   - ✅ Can view threads, usage, logs
   - ❌ Cannot modify project settings
   - ❌ Cannot create/delete API keys

#### Editor Role

1. Change role to "Editor"
2. Verify:
   - ✅ Can view threads, usage, logs
   - ✅ Can create API keys
   - ❌ Cannot manage team members

#### Admin Role

1. Change role to "Admin"
2. Verify:
   - ✅ Full access to all features
   - ✅ Can manage team members
   - ✅ Can change project settings

### 13. Error Handling (`--test errors`)

Test error scenarios and verify they appear in dashboard logs:

#### Invalid API Key
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer invalid-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Test"}]}'
```
**Expected**: 401 Unauthorized

#### Invalid Model
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "invalid-model", "messages": [{"role": "user", "content": "Test"}]}'
```
**Expected**: Error indicating invalid model

#### Missing Provider Prefix
```bash
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Test"}]}'
```
**Expected**: Error about missing provider prefix (e.g., "No provider found")

> **Note**: If this succeeds, it means provider auto-attachment is working. Verify in response that `provider` field is populated.

#### Rate Limit Testing (Optional)
Send multiple rapid requests to trigger rate limiting:
```bash
for i in {1..20}; do
  curl -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Test '$i'"}]}' &
done
wait
```
**Expected**: Some requests may return 429 Too Many Requests

#### Verify Errors in Dashboard Logs

After generating errors above:

1. Navigate to Dashboard → Project → Logs
2. [ ] Verify 401 errors appear for invalid API key attempts
3. [ ] Verify model errors are logged
4. [ ] Verify rate limit errors (429) appear if triggered
5. [ ] Check error details expand correctly with request/response info

**Known Issue**: If errors don't appear in logs, this may indicate a logging pipeline issue.

## Test Verification Checklist

| Category       | Test                          | Expected Result                              | Status |
| -------------- | ----------------------------- | -------------------------------------------- | ------ |
| **Onboarding** | Sign up flow                  | Account + project + API key created          | ⬜     |
| **Onboarding** | API key visible               | Can copy key immediately                     | ⬜     |
| **Onboarding** | State after tab switch        | Survives tab/window switch                   | ⬜     |
| **Onboarding** | State after window switch     | Survives workspace/minimize                  | ⬜     |
| **Onboarding** | Provider attached             | Project has provider in settings             | ⬜     |
| **Onboarding** | Signup methods                | Google SSO and email both available          | ⬜     |
| **Onboarding** | Curl command shown            | Displays with correct model format           | ⬜     |
| **API**        | Chat completions              | 200 response with completion                 | ⬜     |
| **API**        | With x-thread-id              | 200 response, thread created                 | ⬜     |
| **API**        | With x-resource-id            | 200 response, resource tracked               | ⬜     |
| **API**        | Model with provider prefix    | Works: `openai/gpt-4o`                       | ⬜     |
| **API**        | Model without prefix          | Error about missing provider                 | ⬜     |
| **API**        | Multiple API keys             | Both keys work for same project              | ⬜     |
| **Memory**     | Persistence                   | Second message recalls first                 | ⬜     |
| **Threads**    | List threads                  | Returns array of threads                     | ⬜     |
| **Threads**    | Get thread                    | Returns thread details                       | ⬜     |
| **Threads**    | Get messages                  | Returns messages in thread                   | ⬜     |
| **OM**         | Extended conversation         | Tokens stay reasonable (not 100k+)           | ⬜     |
| **OM**         | Token tracking                | OM tokens shown separately in usage          | ⬜     |
| **OM**         | Multi-model thread            | Both providers access shared context         | ⬜     |
| **OM**         | Thresholds                    | Settings display correct defaults            | ⬜     |
| **BYOK**       | Via header (OpenAI)           | `is_byok: true` in response                  | ⬜     |
| **BYOK**       | Via header (Anthropic)        | `is_byok: true` in response                  | ⬜     |
| **BYOK**       | Via header (Google)           | `is_byok: true` in response                  | ⬜     |
| **BYOK**       | Via settings                  | Request uses configured key                  | ⬜     |
| **Usage**      | Token counts                  | Match actual usage                           | ⬜     |
| **Usage**      | Cost breakdown                | Accurate per model                           | ⬜     |
| **Usage**      | Charts                        | Render correctly                             | ⬜     |
| **Dashboard**  | Projects page                 | Lists projects correctly                     | ⬜     |
| **Dashboard**  | Threads page                  | Lists threads, details work                  | ⬜     |
| **Logs**       | Request logs displayed        | Shows recent requests                        | ⬜     |
| **Logs**       | Prompt tokens shown           | Not just cached_tokens                       | ⬜     |
| **Logs**       | Completion tokens shown       | Displays correctly                           | ⬜     |
| **Logs**       | Cache tokens                  | cache_write_tokens not always 0              | ⬜     |
| **Errors**     | Rate limit in dashboard       | 429 errors appear in logs                    | ⬜     |
| **Errors**     | Invalid key logged            | 401 errors appear in logs                    | ⬜     |
| **Account**    | Sign up flow                  | Org + project + API key created              | ⬜     |
| **Account**    | API key visible               | Can copy key immediately                     | ⬜     |
| **Invites**    | Send invitation               | Email sent to invitee                        | ⬜     |
| **Invites**    | Accept invitation             | Invitee can access project                   | ⬜     |
| **RBAC**       | Viewer role                   | Read-only access                             | ⬜     |
| **RBAC**       | Editor role                   | Can modify, cannot manage team               | ⬜     |
| **RBAC**       | Admin role                    | Full access to all features                  | ⬜     |
| **Errors**     | Invalid key                   | 401, error in logs                           | ⬜     |
| **Errors**     | Rate limit                    | Error shown in dashboard                     | ⬜     |

## Troubleshooting

### "No provider" error
- Ensure model format is `provider/model` (e.g., `openai/gpt-4o`)
- Check if project has provider attached (may need re-creation)

### BYOK not working
- Verify header name: `x-openai-api-key`, `x-anthropic-api-key`, `x-google-api-key`
- Check key is valid with direct API call
- Ensure no trailing whitespace

### Thread not found
- Thread IDs are scoped per project/user
- Two different users cannot share the same thread ID

### Usage not reflecting
- Wait a few seconds for usage to sync
- Check if request actually succeeded (not cached/failed)
- Verify date range selector in usage page

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/test-api.sh` | Run all API endpoint tests |
| `scripts/test-memory.sh` | Test memory persistence |

## References

| File | Description |
|------|-------------|
| `references/api-endpoints.md` | Full API endpoint reference |
| `references/dashboard-ui.md` | Dashboard testing details |
