# Cloud Deployment Setup

Instructions specific to `--env staging` and `--env production` testing.

## Prerequisites

- Mastra platform account with deploy access
- `pnpx` (or `npx`) available
- For debugging: GCP Console access (see `gcp-debugging.md`)

## Environment Setup

Set the platform URL based on target environment:

```bash
# For staging
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai

# For production (default, can be unset)
export MASTRA_PLATFORM_API_URL=https://platform.mastra.ai
# Or simply: unset MASTRA_PLATFORM_API_URL
```

## LLM API Key

Ensure `.env` has the required API key:

| Provider | Environment Variable |
|----------|---------------------|
| openai | `OPENAI_API_KEY` |
| anthropic | `ANTHROPIC_API_KEY` |
| groq | `GROQ_API_KEY` |
| google | `GOOGLE_GENERATIVE_AI_API_KEY` |

## Authenticate with Platform

```bash
# Logout first for clean state (optional)
pnpx mastra@latest auth logout

# Login to target environment
pnpx mastra@latest auth login
```

This opens a browser for OAuth. Complete the login flow.

## Deploy Studio

```bash
pnpx mastra@latest studio deploy -y
```

Wait for deployment. Note the URL:
- Staging: `https://<project>.studio.staging.mastra.cloud`
- Production: `https://<project>.studio.mastra.cloud`

**Verify**: Open URL, sign in, confirm Studio UI loads.

## Deploy Server

```bash
pnpx mastra@latest server deploy -y
```

The `-y` flag auto-confirms settings.

Note the URL:
- Staging: `https://<project>.server.staging.mastra.cloud`
- Production: `https://<project>.server.mastra.cloud`

**Verify health**:

```bash
curl https://<project>.server.<env>.mastra.cloud/health
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

| Source | How to Identify |
|--------|-----------------|
| Studio traces | Generated from Studio UI interactions |
| Server traces | Generated from direct API calls to deployed server |

Both should appear in the Studio's Traces page. If only Studio traces appear, there's a trace pipeline issue.

## Testing Custom API Routes (Deployed)

After deploying a server with custom routes:

```bash
curl https://<project>.server.<env>.mastra.cloud/hello
# Expected: {"message":"Hello from custom route!"}
```

## Browser Agent (Deployed)

When testing browser agents in deployed environments:
- Set `headless: true` in the browser config
- Browser runs server-side in the deployed container

## Quick Commands Reference

```bash
# === Environment ===
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai  # staging
unset MASTRA_PLATFORM_API_URL  # production

# === Auth ===
pnpx mastra@latest auth login
pnpx mastra@latest auth logout

# === Deploy ===
pnpx mastra@latest studio deploy -y
pnpx mastra@latest server deploy -y

# === Test ===
curl https://<project>.server.<env>.mastra.cloud/health
curl -X POST https://<project>.server.<env>.mastra.cloud/api/agents/<agent-id>/generate \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

## Troubleshooting

### "Session expired" errors in Studio

Known issue with cookie domain mismatch. The Studio may need re-authentication periodically.

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
