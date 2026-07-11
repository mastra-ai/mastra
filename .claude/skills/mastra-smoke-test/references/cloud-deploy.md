# Cloud Deployment Setup

Instructions specific to `--env staging` and `--env production` testing.

## Prerequisites

- Mastra platform account with deploy access
- `pnpx` (or `npx`) available
- For debugging: GCP Console access (see `gcp-debugging.md`)

## Multi-Environment Config

Deploy to staging and production from the same project using separate config files:

| Environment | Config File                    | Platform API URL                     | Deploy URLs                             |
| ----------- | ------------------------------ | ------------------------------------ | --------------------------------------- |
| Production  | `.mastra-project.json`         | `https://platform.mastra.ai`         | `<project>.studio.mastra.cloud`         |
| Staging     | `.mastra-project-staging.json` | `https://platform.staging.mastra.ai` | `<project>.studio.staging.mastra.cloud` |

Each environment gets its own project ID, so they don't interfere.

## Environment Setup

Set the platform URL based on target environment:

```bash
# For production
export MASTRA_PLATFORM_API_URL=https://platform.mastra.ai

# For staging
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai
```

## LLM API Key

Ensure `.env` has the required API key:

| Provider  | Environment Variable           |
| --------- | ------------------------------ |
| openai    | `OPENAI_API_KEY`               |
| anthropic | `ANTHROPIC_API_KEY`            |
| groq      | `GROQ_API_KEY`                 |
| google    | `GOOGLE_GENERATIVE_AI_API_KEY` |

## Authenticate with Platform

### Check Existing Credentials

Before triggering a browser login, check if credentials exist and are valid:

```bash
# Check if credentials file exists
cat ~/.mastra/credentials.json | jq '{email: .user.email, organizationId}'

# Verify token is still valid
TOKEN=$(jq -r '.token' ~/.mastra/credentials.json)
ORG_ID=$(jq -r '.currentOrgId // .organizationId' ~/.mastra/credentials.json)
curl -s "$MASTRA_PLATFORM_API_URL/v1/auth/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq '.user.email'
```

### Token Refresh (if expired)

WorkOS tokens expire in 5 minutes, but can be refreshed without re-login:

```bash
REFRESH_TOKEN=$(jq -r '.refreshToken' ~/.mastra/credentials.json)
curl -s "$MASTRA_PLATFORM_API_URL/v1/auth/refresh-token" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

See `references/tests/traces.md` for the full `get_valid_token` helper function.

### Login (only if refresh fails)

**⚠️ Always warn the user before running this** — it opens a browser:

```bash
# Logout first for clean state (optional)
pnpx mastra@latest auth logout

# Login to target environment
pnpx mastra@latest auth login
```

This opens a browser for OAuth. Complete the login flow.

### Verify Organization

The browser may default to a different account/org. Always verify after login:

```bash
cat ~/.mastra/credentials.json | jq '{email: .user.email, organizationId}'
```

## Deploy Studio

```bash
# Production (uses .mastra-project.json by default)
pnpx mastra@latest studio deploy -y

# Staging (specify config file)
pnpx mastra@latest studio deploy --config .mastra-project-staging.json -y
```

Wait for deployment. Note the URL from output:

- Production: `https://<project>.studio.mastra.cloud`
- Staging: `https://<project>.studio.staging.mastra.cloud`

**Verify**: Open URL, sign in, confirm Studio UI loads.

## Deploy Server

```bash
# Production
pnpx mastra@latest server deploy -y

# Staging
pnpx mastra@latest server deploy --config .mastra-project-staging.json -y
```

The `-y` flag auto-confirms settings.

Note the URL from output:

- Production: `https://<project>.server.mastra.cloud`
- Staging: `https://<project>.server.staging.mastra.cloud`

**Verify health**:

```bash
# Staging
curl https://<project>.server.staging.mastra.cloud/health

# Production (no environment subdomain)
curl https://<project>.server.mastra.cloud/health

# Expected: {"success":true}
```

## Test Server API

Use the helper script:

```bash
.claude/skills/mastra-smoke-test/scripts/test-server.sh <server-url> [agent-id] [message]

# Examples
.claude/skills/mastra-smoke-test/scripts/test-server.sh https://my-app.server.staging.mastra.cloud
.claude/skills/mastra-smoke-test/scripts/test-server.sh https://my-app.server.mastra.cloud weather-agent "Weather in Tokyo?"
```

The script:

1. Checks `/health` endpoint
2. Calls agent's `/generate` endpoint
3. Parses and displays response
4. Exits with error if checks fail

## Verify Server Traces in Studio

**Critical step** — verifies the full trace pipeline works:

1. Make a Server API call (using script or curl)
2. Return to Studio UI → Observability → Traces
3. Refresh the page
4. Verify traces from Server API call appear

If traces don't appear, see `gcp-debugging.md`.

## Server Trace Verification

| Source        | How to Identify                                    |
| ------------- | -------------------------------------------------- |
| Studio traces | Generated from Studio UI interactions              |
| Server traces | Generated from direct API calls to deployed server |

Both should appear in the Studio's Traces page. If only Studio traces appear, there's a trace pipeline issue.

## Testing Custom API Routes (Deployed)

After deploying a server with custom routes:

```bash
# Staging
curl https://<project>.server.staging.mastra.cloud/hello

# Production
curl https://<project>.server.mastra.cloud/hello

# Expected: {"message":"Hello from custom route!"}
```

## Browser Agent (Deployed)

When testing browser agents in deployed environments:

- Set `headless: true` in the browser config
- Browser runs server-side in the deployed container

## Quick Commands Reference

```bash
# === Environment ===
export MASTRA_PLATFORM_API_URL=https://platform.mastra.ai          # production
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai  # staging

# === Auth (warn user before login - opens browser!) ===
pnpx mastra@latest auth login
pnpx mastra@latest auth logout

# === Deploy (production) ===
pnpx mastra@latest studio deploy -y
pnpx mastra@latest server deploy -y

# === Deploy (staging) ===
pnpx mastra@latest studio deploy --config .mastra-project-staging.json -y
pnpx mastra@latest server deploy --config .mastra-project-staging.json -y

# === Test (use actual URLs from deploy output) ===
curl https://<project>.server.mastra.cloud/health           # production
curl https://<project>.server.staging.mastra.cloud/health   # staging

# === Agent call ===
curl -X POST <server-url>/api/agents/<agent-id>/generate \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'

# === Check traces directly ===
TOKEN=$(jq -r '.token' ~/.mastra/credentials.json)
PROJECT_ID=$(jq -r '.projectId' .mastra-project.json)
ORG_ID=$(jq -r '.organizationId' .mastra-project.json)
curl -s "https://mobs-query-vgvrl5lbxq-uc.a.run.app/api/observability/traces?resourceId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq '.traces | length'
```

## Troubleshooting

### Wrong Organization on Login

The browser may default to a different account/org. Always verify after login:

```bash
cat ~/.mastra/credentials.json | jq '{email: .user.email, organizationId}'
```

### Token Expired (401 errors)

WorkOS tokens expire after 5 minutes. Check token validity before re-logging in — use the refresh token first. See the `get_valid_token` helper in `references/tests/traces.md`.

### "Session expired" errors in Studio

Known issue with cookie domain mismatch. The Studio may need re-authentication periodically.

### Custom Routes Not Working

Custom routes must use `apiRoutes` (not `routes`) in the server config:

```typescript
server: {
  apiRoutes: [helloRoute],  // ✅ Correct
  // routes: [helloRoute],  // ❌ Wrong - silently fails
}
```

This is a common typo that causes routes to silently not register.

### CORS Errors

Server deploys inject CORS config via `SERVER_WRAPPER`. If you see CORS errors:

1. Check `MASTRA_CORS_ORIGIN` env var is set correctly on the deploy
2. Verify the origin domain matches the studio domain pattern

### Server traces not appearing

1. Check `mobs-collector` logs (GCP Console)
   - `POST 200` = traces received
   - `POST 401` = JWT auth failed
   - `POST 404` = wrong endpoint

2. If `401 invalid signature`: JWT_SECRET mismatch between services

3. If "mastra-cloud-observability-exporter disabled" in deploy logs:
   - `JWT_SECRET` not configured on platform-api
   - Server can't get `MASTRA_CLOUD_ACCESS_TOKEN`

See `gcp-debugging.md` for detailed debugging steps.

### Deploy fails with auth error

```bash
pnpx mastra@latest auth logout
pnpx mastra@latest auth login
```

Then retry deploy.
