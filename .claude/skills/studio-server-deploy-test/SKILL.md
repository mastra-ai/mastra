---
name: studio-server-deploy-test
description: Deploy and smoke test Mastra Studio and Server to staging or production. Verifies deployments work, agent chat functions, and traces flow correctly through the observability pipeline. Use this skill after infrastructure or platform changes to validate the deploy flow.
model: claude-sonnet-4-20250514
---

# Studio/Server Deploy Smoke Test

Deploys a Mastra project's Studio and Server to the cloud platform and verifies everything works end-to-end, including trace ingestion.

## Usage

```text
smoke test deploy to staging with new project
smoke test deploy to production using existing project at ~/my-project
deploy test --env staging --new-project --directory ~/projects --name test-app
deploy test --env production --existing-project ~/my-existing-app
```

## Parameters

| Parameter            | Short | Description                                                    | Required | Default      |
| -------------------- | ----- | -------------------------------------------------------------- | -------- | ------------ |
| `--env`              | `-e`  | Target environment: `staging` or `production`                  | No       | `production` |
| `--new-project`      |       | Create a new project (mutually exclusive with --existing-project) | No    | -            |
| `--existing-project` |       | Path to existing Mastra project                                | No       | -            |
| `--directory`        | `-d`  | Parent directory for new project (required with --new-project) | No       | -            |
| `--name`             | `-n`  | Project name for new project (required with --new-project)     | No       | -            |
| `--skip-browser`     |       | Skip browser-based UI testing, use curl only                   | No       | `false`      |

## Prerequisites

1. **CLI Tools**: `pnpx` (or `npx`), `curl`, `jq`
2. **Platform Account**: Mastra account with access to deploy
3. **API Key**: `OPENAI_API_KEY` (or appropriate LLM provider key)
4. **Browser** (optional): For UI testing, browser tools should be enabled

For debugging trace issues:
- **GCP Console Access**: To view `mobs-collector`, `gateway-platform-api` logs

## Environment Setup

Set the platform URL based on target environment:

```bash
# For staging
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai

# For production (default, can be unset)
export MASTRA_PLATFORM_API_URL=https://platform.mastra.ai
# Or simply: unset MASTRA_PLATFORM_API_URL
```

## Execution Steps

### Step 1: Project Setup

**Option A: Create New Project**

```bash
cd <directory>
pnpx create-mastra@latest <project-name> --default
cd <project-name>
```

The `--default` flag creates a project with the weather agent example.

**Option B: Use Existing Project**

```bash
cd <existing-project-path>
```

Verify it has:
- `package.json` with `@mastra/core`
- `src/mastra/index.ts` with a Mastra instance
- At least one agent configured

### Step 2: Configure Environment

Ensure `.env` file exists with required API keys:

```bash
# Check if .env exists
cat .env 2>/dev/null || echo "OPENAI_API_KEY=<your-key>" > .env
```

### Step 3: Authenticate with Platform

```bash
# Logout first to ensure clean state (optional)
pnpx mastra@latest auth logout

# Login to the target environment
pnpx mastra@latest auth login
```

This opens a browser for OAuth. Complete the login flow.

### Step 4: Deploy Studio

```bash
pnpx mastra@latest studio deploy
```

Wait for deployment to complete. Note the deployed URL:
- Staging: `https://<project>.studio.staging.mastra.cloud`
- Production: `https://<project>.studio.mastra.cloud`

**Verify**: Open the URL in a browser, sign in, and confirm the Studio UI loads.

### Step 5: Deploy Server

```bash
pnpx mastra@latest server deploy -y
```

The `-y` flag auto-confirms deployment settings.

Note the deployed URL:
- Staging: `https://<project>.server.staging.mastra.cloud`
- Production: `https://<project>.server.mastra.cloud`

**Verify**: Check health endpoint:

```bash
curl https://<project>.server.<staging.>mastra.cloud/health
# Expected: {"success":true}
```

### Step 6: Test Studio Agent Chat (Browser)

1. Navigate to the deployed Studio URL
2. Go to the Agents page
3. Open the Weather Agent (or available agent)
4. Send a test message: "What is the weather in Tokyo?"
5. Verify the agent responds

### Step 7: Verify Studio Traces

1. Navigate to Observability → Traces in Studio UI
2. Verify traces appear from Step 6 (agent run, scorer runs if configured)
3. Note the trace IDs for reference

### Step 8: Test Server API

Use the helper script from this skill:

```bash
# From the skill directory
.claude/skills/studio-server-deploy-test/scripts/test-server.sh <server-url> [agent-id] [message]

# Examples
.claude/skills/studio-server-deploy-test/scripts/test-server.sh https://my-project.server.staging.mastra.cloud
.claude/skills/studio-server-deploy-test/scripts/test-server.sh https://my-project.server.mastra.cloud weather-agent "What's the weather in Tokyo?"
```

The script will:
1. Check `/health` endpoint
2. Call the agent's `/generate` endpoint
3. Parse and display the response
4. Exit with error if either check fails

Verify the response includes weather data (or relevant agent output).

### Step 9: Verify Server Traces in Studio

1. Return to Studio UI → Observability → Traces
2. Refresh the page
3. **Critical**: Verify traces from the Server API call (Step 8) appear
4. If traces don't appear, see [Troubleshooting](#troubleshooting)

## Test Verification Checklist

| Test | Expected Result | Status |
|------|-----------------|--------|
| Studio deploy | URL accessible, can sign in | ⬜ |
| Server deploy | `/health` returns `{"success":true}` | ⬜ |
| Studio agent chat | Agent responds to messages | ⬜ |
| Studio traces | Traces visible after chat | ⬜ |
| Server API call | Returns valid agent response | ⬜ |
| Server traces in Studio | Traces from API call visible | ⬜ |

## Troubleshooting

### Server traces not appearing in Studio

This is the most common issue. Check in order:

1. **Check `mobs-collector` logs** (GCP Console)
   - `POST 200` = traces received successfully
   - `POST 401` = JWT authentication failed (see below)
   - `POST 404` = wrong endpoint path

2. **If `401 invalid signature`**:
   - JWT_SECRET mismatch between services
   - See `references/common-errors.md` for fix

3. **If "mastra-cloud-observability-exporter disabled"** in deploy logs:
   - `JWT_SECRET` not configured on platform-api
   - Server can't get `MASTRA_CLOUD_ACCESS_TOKEN`

### Studio shows "Session expired" errors

Known issue with cookie domain mismatch. The Studio may need re-authentication periodically.

### Full debugging guides

See `references/` directory:
- `architecture.md` - Trace flow diagrams
- `common-errors.md` - Error symptoms and fixes
- `environment-variables.md` - All env vars explained
- `gcp-debugging.md` - GCP Console navigation

## Quick Commands Reference

```bash
# === Environment ===
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai  # staging
unset MASTRA_PLATFORM_API_URL  # production

# === Auth ===
pnpx mastra@latest auth login
pnpx mastra@latest auth logout

# === Deploy ===
pnpx mastra@latest studio deploy
pnpx mastra@latest server deploy -y

# === Test ===
curl https://<project>.server.<env>.mastra.cloud/health
curl -X POST https://<project>.server.<env>.mastra.cloud/api/agents/<agent-id>/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

## Advanced Tests (Optional)

For more comprehensive testing, consider:

1. **Custom Server Routes**: Add custom API routes and verify they deploy
2. **MCP Clients**: Test MCP tool integration
3. **@mastra/client-js Frontend**: Set up a frontend app that calls the deployed server
4. **Team Invites**: Test inviting team members with different permission levels

These are documented in the Notion doc: [Studio/Server Testing Instructions](https://www.notion.so/kepler-inc/Studio-Server-Testing-Instructions-334ebffbc9f8800c9ffcf1d0d370b46e)
