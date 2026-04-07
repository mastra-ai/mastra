# Platform Smoke Test

## Description

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
| `--test`            | No       | `all`        | Specific test: `api`, `memory`, `om`, `threads`, `byok`, `usage`, `dashboard`, `onboarding`, `account`, `invites`, `rbac` |
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
5. Copy the generated API key
6. **Important**: Note the API key immediately - it may not be shown again

```bash
export MASTRA_API_KEY="msk_..."
```

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

Test OM features (Observer, Reflector, thresholds):

#### Verify OM Activation

Send multiple messages in a thread to trigger OM:

```bash
THREAD_ID="om-test-$(date +%s)"

# Send several messages to build context
for i in 1 2 3 4 5; do
  curl -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -H "x-thread-id: $THREAD_ID" \
    -d "{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"Message $i: Tell me something interesting\"}]}"
  sleep 1
done
```

#### Check OM Token Usage

Navigate to Dashboard → Project → Usage to verify:
- OM tokens are being tracked separately
- Token counts match expected usage

#### OM Thresholds

1. Navigate to Dashboard → Project → Settings
2. Check OM Threshold settings
3. Verify defaults are displayed correctly
4. (Optional) Modify thresholds and verify behavior changes

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
- Request logs displayed
- Can filter by date/status
- Log details expand correctly
- Token counts shown

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

### 13. Error Handling

Test error scenarios:

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
**Expected**: Should work if provider is auto-attached, otherwise error

#### Verify Errors in Dashboard
- Check Logs page for error entries
- Verify error details are captured

## Test Verification Checklist

| Category       | Test                          | Expected Result                              | Status |
| -------------- | ----------------------------- | -------------------------------------------- | ------ |
| **Onboarding** | Sign up flow                  | Account + project + API key created          | ⬜     |
| **Onboarding** | API key visible               | Can copy key immediately after creation      | ⬜     |
| **API**        | Chat completions              | 200 response with completion                 | ⬜     |
| **API**        | With x-thread-id              | 200 response, thread created                 | ⬜     |
| **API**        | With x-resource-id            | 200 response, resource tracked               | ⬜     |
| **API**        | Model with provider prefix    | Works: `openai/gpt-4o`                       | ⬜     |
| **Memory**     | Persistence                   | Second message recalls first                 | ⬜     |
| **Threads**    | List threads                  | Returns array of threads                     | ⬜     |
| **Threads**    | Get thread                    | Returns thread details                       | ⬜     |
| **Threads**    | Get messages                  | Returns messages in thread                   | ⬜     |
| **OM**         | Token tracking                | OM tokens shown in usage                     | ⬜     |
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
| **Dashboard**  | Logs page                     | Shows request logs                           | ⬜     |
| **Dashboard**  | Usage page                    | Shows usage/cost data                        | ⬜     |
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
