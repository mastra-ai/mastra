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
| `--tag`              | `-t`  | Version tag for create-mastra (e.g., `latest`, `alpha`)        | No       | `latest`     |
| `--pm`               | `-p`  | Package manager: `npm`, `yarn`, `pnpm`, or `bun`               | No       | `pnpm`       |
| `--llm`              | `-l`  | LLM provider: `openai`, `anthropic`, `groq`, `google`          | No       | `openai`     |
| `--skip-browser`     |       | Skip browser-based UI testing, use curl only                   | No       | `false`      |
| `--test`             |       | Run specific test only: `studio`, `server`, `traces`, `tools`, `workflows` | No | (full test) |

## Prerequisites

1. **CLI Tools**: `pnpx` (or `npx`), `curl`, `jq`
2. **Platform Account**: Mastra account with access to deploy
3. **API Key**: `OPENAI_API_KEY` (or appropriate LLM provider key based on `--llm`)
4. **Browser**: For UI testing, browser tools should be enabled (`/browser on`)

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

# Using pnpm (default)
pnpm create mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llm> -e

# Using npm
npx create-mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llm> -e

# Using yarn
yarn create mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llm> -e

# Using bun
bunx create-mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llm> -e

cd <project-name>
```

**Flags explained:**
- `-c agents,tools,workflows,scorers` - Include all components for full testing
- `-l <provider>` - Set the LLM provider (`openai`, `anthropic`, etc.)
- `-e` - Include example code (weather agent, tools, workflows)

**Option B: Use Existing Project**

```bash
cd <existing-project-path>
```

Verify it has:
- `package.json` with `@mastra/core`
- `src/mastra/index.ts` with a Mastra instance
- At least one agent configured

### Step 2: Configure Environment

Based on the selected LLM provider, ensure `.env` has the required API key:

| Provider   | Required Environment Variable    |
|------------|----------------------------------|
| openai     | `OPENAI_API_KEY`                 |
| anthropic  | `ANTHROPIC_API_KEY`              |
| groq       | `GROQ_API_KEY`                   |
| google     | `GOOGLE_GENERATIVE_AI_API_KEY`   |

**Check in this order:**
1. Check global environment: `echo $<ENV_VAR_NAME>`
2. Check project `.env` file
3. Ask user only if not found

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

### Step 6: Studio UI Testing (Browser)

Navigate to the deployed Studio URL and test each section.

#### 6.1 Agents (`/agents`)
- [ ] Navigate to `/agents`
- [ ] Verify agents list loads (should see Weather Agent)
- [ ] Click on Weather Agent
- [ ] Send test message: "What is the weather in Tokyo?"
- [ ] Verify agent responds with weather data

#### 6.2 Tools (`/tools`)
- [ ] Navigate to `/tools`
- [ ] Verify tools list loads
- [ ] Click on `get-weather` tool
- [ ] Enter "London" in city input
- [ ] Click Submit
- [ ] Verify JSON output with weather data

#### 6.3 Workflows (`/workflows`)
- [ ] Navigate to `/workflows`
- [ ] Verify workflows list loads
- [ ] Click on `weather-workflow`
- [ ] Enter "Berlin" in city input
- [ ] Click Run
- [ ] Verify workflow execution succeeds

#### 6.4 Evaluation/Scorers (`/evaluation?tab=scorers`)
- [ ] Navigate to `/evaluation?tab=scorers`
- [ ] Verify scorers list loads (3 example scorers if created with `-e`)

#### 6.5 Observability - Traces (`/observability`)
- [ ] Navigate to `/observability`
- [ ] Verify traces from agent chat appear
- [ ] Note trace IDs for reference

#### 6.6 Observability - Logs (`/logs`)
- [ ] Navigate to `/logs`
- [ ] Verify server logs appear

#### 6.7 Other Pages
- [ ] `/settings` - Verify settings page loads
- [ ] `/mcps` - Verify MCP servers page loads (empty state OK)

### Step 7: Test Server API

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

### Step 8: Verify Server Traces in Studio

1. Return to Studio UI → Observability → Traces
2. Refresh the page
3. **Critical**: Verify traces from the Server API call (Step 7) appear
4. If traces don't appear, see [Troubleshooting](#troubleshooting)

## Test Verification Checklist

| Category | Test | Expected Result | Status |
|----------|------|-----------------|--------|
| **Deploy** | Studio deploy | URL accessible, can sign in | ⬜ |
| **Deploy** | Server deploy | `/health` returns `{"success":true}` | ⬜ |
| **Agents** | Agent chat | Agent responds to messages | ⬜ |
| **Tools** | Tool execution | Returns valid JSON output | ⬜ |
| **Workflows** | Workflow run | Executes successfully | ⬜ |
| **Scorers** | Scorers list | Shows configured scorers | ⬜ |
| **Traces** | Studio traces | Traces visible after chat | ⬜ |
| **Traces** | Server traces | Traces from API call visible in Studio | ⬜ |
| **Server** | Server API call | Returns valid agent response | ⬜ |

## Partial Testing (--test flag)

To test a specific flow only:

```bash
# Test just studio deploy + UI
smoke test --test studio --existing-project ~/my-app

# Test just server deploy + API
smoke test --test server --existing-project ~/my-app

# Test just traces (requires both deployed)
smoke test --test traces --existing-project ~/my-app

# Test tools page only
smoke test --test tools --existing-project ~/my-app

# Test workflows page only
smoke test --test workflows --existing-project ~/my-app
```

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

## Studio Routes Reference

| Feature         | Route                     |
|-----------------|---------------------------|
| Agents          | `/agents`                 |
| Agent Chat      | `/agents/<id>/chat`       |
| Workflows       | `/workflows`              |
| Tools           | `/tools`                  |
| Evaluation      | `/evaluation`             |
| Scorers         | `/evaluation?tab=scorers` |
| Observability   | `/observability`          |
| Logs            | `/logs`                   |
| MCP Servers     | `/mcps`                   |
| Settings        | `/settings`               |

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
