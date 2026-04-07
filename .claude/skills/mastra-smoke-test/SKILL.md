---
name: mastra-smoke-test
description: Smoke test Mastra projects locally or deploy to staging/production. Tests Studio UI, agents, tools, workflows, traces, memory, and more. Supports both local development and cloud deployments.
---

# Mastra Smoke Test

Comprehensive smoke testing for Mastra projects. Works for local development (`--env local`) or cloud deployments (`--env staging` / `--env production`).

## Usage

```text
# Local development testing
smoke test --env local --existing-project ~/my-app
smoke test --env local -d ~/projects -n new-test-app

# Cloud deployment testing
smoke test --env staging --existing-project ~/my-app
smoke test --env production -d ~/projects -n prod-test --tag latest

# Partial testing
smoke test --env local --existing-project ~/my-app --test agents
smoke test --env staging --existing-project ~/my-app --test traces
```

## Parameters

| Parameter            | Short | Description                                                                  | Required | Default  |
| -------------------- | ----- | ---------------------------------------------------------------------------- | -------- | -------- |
| `--env`              | `-e`  | Environment: `local`, `staging`, `production`                                | **Yes**  | -        |
| `--directory`        | `-d`  | Parent directory for new project                                             | *        | -        |
| `--name`             | `-n`  | Project name                                                                 | *        | -        |
| `--existing-project` |       | Path to existing Mastra project                                              | *        | -        |
| `--tag`              | `-t`  | Version tag for create-mastra or dependency update (e.g., `latest`, `alpha`) | No       | `latest` |
| `--pm`               | `-p`  | Package manager: `npm`, `yarn`, `pnpm`, `bun`                                | No       | `pnpm`   |
| `--llm`              | `-l`  | LLM provider: `openai`, `anthropic`, `groq`, `google`, `cerebras`, `mistral` | No       | `openai` |
| `--db`               |       | Storage backend: `libsql`, `pg`, `turso`                                     | No       | `libsql` |
| `--test`             |       | Run specific test (see below)                                                | No       | (full)   |
| `--browser-agent`    |       | Add a browser-enabled agent to the project                                   | No       | `false`  |
| `--skip-browser`     |       | Skip browser UI tests, use curl only (staging/production)                    | No       | `false`  |
| `--byok`             |       | Test bring-your-own-key flow (staging/production)                            | No       | `false`  |

\* Either `--directory` + `--name` OR `--existing-project` is required

## Test Options (`--test`)

| Option | Description | Environments |
|--------|-------------|--------------|
| `agents` | Test agents page and chat | All |
| `tools` | Test tools page and execution | All |
| `workflows` | Test workflows page and run | All |
| `traces` | Test observability/traces | All |
| `scorers` | Test evaluation/scorers page | All |
| `memory` | Test conversation persistence | All |
| `mcp` | Test MCP servers page | All |
| `errors` | Test error handling | All |
| `studio` | Test Studio deploy only | staging, production |
| `server` | Test Server deploy only | staging, production |
| `account` | Test account creation flow | staging, production |
| `invites` | Test team invitation flow | staging, production |
| `rbac` | Test role-based access | staging, production |

## Prerequisites

### All Environments
- Node.js and package manager (`pnpm` recommended)
- LLM API key (e.g., `OPENAI_API_KEY`)

### Local (`--env local`)
- Browser tools enabled (`/browser on`) for UI testing
- Works with Stagehand or AgentBrowser providers

### Staging/Production (`--env staging` / `--env production`)
- Mastra platform account with deploy access
- For debugging: GCP Console access (see `references/gcp-debugging.md`)

## Execution Steps

### Step 1: Project Setup

**Option A: Create New Project**

```bash
cd <directory>
<pm> create mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llm> -e
cd <project-name>
```

Flags:
- `-c agents,tools,workflows,scorers` — Include all components
- `-l <provider>` — Set LLM provider
- `-e` — Include example code

**Option B: Use Existing Project**

```bash
cd <existing-project-path>
```

Verify it has:
- `package.json` with `@mastra/core`
- `src/mastra/index.ts` with a Mastra instance
- At least one agent configured

**If `--tag` is provided with existing project**, update dependencies:

```bash
# Update all @mastra/* packages to the specified tag
<pm> add @mastra/core@<tag> @mastra/memory@<tag> @mastra/libsql@<tag> mastra@<tag>
```

Only update packages that exist in the project's `package.json`.

### Step 2: Storage Backend (--db)

| Backend | Package | Environment Variables |
|---------|---------|----------------------|
| `libsql` (default) | `@mastra/libsql` | None (local file) |
| `pg` | `@mastra/pg` | `DATABASE_URL` |
| `turso` | `@mastra/turso` | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |

For non-default backends, install the package and configure `.env`.

### Step 3: Browser Agent (--browser-agent)

**Skip if `--browser-agent` not provided.**

1. Install packages:
```bash
<pm> add @mastra/stagehand @mastra/memory
```

2. Create `src/mastra/agents/browser-agent.ts`:
```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { StagehandBrowser } from '@mastra/stagehand';

export const browserAgent = new Agent({
  id: 'browser-agent',
  name: 'Browser Agent',
  instructions: `You are a helpful assistant that can browse the web.`,
  model: '<provider>/<model>',
  memory: new Memory(),
  browser: new StagehandBrowser({
    headless: false, // true for cloud deploys
  }),
});
```

3. Register in `src/mastra/index.ts`:
```typescript
import { browserAgent } from './agents/browser-agent';
agents: { weatherAgent, browserAgent },
```

### Step 4: Custom API Routes (Optional)

To test custom server routes:

1. Create `src/mastra/routes/hello.ts`:
```typescript
import { registerApiRoute } from '@mastra/core/server';

export const helloRoute = registerApiRoute('/hello', {
  method: 'GET',
  handler: async (c) => {
    return c.json({ message: 'Hello from custom route!' });
  },
});
```

2. Register in `src/mastra/index.ts`:
```typescript
import { helloRoute } from './routes/hello';
server: { routes: [helloRoute] },
```

### Step 5: Environment-Specific Setup

- **Local**: See `references/local-setup.md`
- **Staging/Production**: See `references/cloud-deploy.md`

### Step 6: Run Test Flows

#### Agents (`/agents`)
- [ ] Navigate to `/agents`
- [ ] Verify agents list loads
- [ ] Click on Weather Agent (or first agent)
- [ ] Send test message: "What's the weather in Tokyo?"
- [ ] Verify agent responds

#### Tools (`/tools`)
- [ ] Navigate to `/tools`
- [ ] Verify tools list loads
- [ ] Click on `get-weather` tool
- [ ] Enter "London" in city input
- [ ] Click Submit
- [ ] Verify JSON output with weather data

#### Workflows (`/workflows`)
- [ ] Navigate to `/workflows`
- [ ] Verify workflows list loads
- [ ] Click on `weather-workflow`
- [ ] Enter "Berlin" in city input
- [ ] Click Run
- [ ] Verify workflow execution succeeds

#### Evaluation/Scorers (`/evaluation?tab=scorers`)
- [ ] Navigate to `/evaluation?tab=scorers`
- [ ] Verify scorers list loads

#### Observability - Traces (`/observability`)
- [ ] Navigate to `/observability`
- [ ] Verify traces from previous actions appear
- [ ] Click on a trace to view details
- [ ] Verify trace shows: agent name, input/output, duration, status

**Traces Verification:**

| Action | Expected Trace |
|--------|---------------|
| Agent chat | `agent run: 'weather-agent'` |
| Tool execution | `tool call: 'get-weather'` |
| Workflow run | `workflow run: 'weather-workflow'` |
| Scorer execution | `scorer run: '<scorer-name>'` |

#### Logs (`/logs`)
- [ ] Navigate to `/logs`
- [ ] Verify server logs appear

#### MCP Servers (`/mcps`)
- [ ] Navigate to `/mcps`
- [ ] Verify page loads (empty state OK)
- [ ] If MCP servers configured:
  - [ ] Verify server appears in list
  - [ ] Check connection status
  - [ ] Verify tools discoverable

#### Memory/Threads Testing
- [ ] Chat with agent
- [ ] Send follow-up referencing previous response
- [ ] Verify agent remembers context
- [ ] Navigate away and back
- [ ] Verify conversation history preserved

#### Error Handling Testing
- [ ] Send agent invalid input (e.g., "Weather in @#$%")
- [ ] Verify error is user-friendly (not stack trace)
- [ ] Submit tool with invalid input
- [ ] Verify clear error message

#### Settings (`/settings`) — staging/production only
- [ ] Navigate to `/settings`
- [ ] Verify settings page loads
- [ ] Check team/project configuration visible

#### Browser Agent (if `--browser-agent`)
- [ ] Navigate to browser-agent
- [ ] Send: "Go to example.com and tell me what you see"
- [ ] Verify agent browses and returns content

### Step 7: Cleanup

- [ ] Close browser session
- [ ] Stop dev server (local) or note deployed URLs (cloud)

### Step 8: Report Results

Provide summary:
- Total tests passed/failed
- Any errors encountered
- Recommendations for issues found

## Test Verification Checklist

| Category | Test | Expected Result | Status |
|----------|------|-----------------|--------|
| **Setup** | Project created/found | Directory exists with package.json | ⬜ |
| **Setup** | Dependencies installed | node_modules present | ⬜ |
| **Agents** | Agent list loads | At least one agent shown | ⬜ |
| **Agents** | Agent chat works | Agent responds to message | ⬜ |
| **Tools** | Tool list loads | Tools displayed | ⬜ |
| **Tools** | Tool execution | Returns valid JSON output | ⬜ |
| **Workflows** | Workflow list loads | Workflows displayed | ⬜ |
| **Workflows** | Workflow run | Executes successfully | ⬜ |
| **Scorers** | Scorers list loads | Scorers displayed | ⬜ |
| **Traces** | Traces page loads | No errors | ⬜ |
| **Traces** | Traces visible | Traces from actions appear | ⬜ |
| **Logs** | Logs page loads | Server logs visible | ⬜ |
| **Memory** | Thread persists | History preserved after navigation | ⬜ |
| **Memory** | Context recall | Agent remembers previous messages | ⬜ |
| **MCP** | MCP page loads | No errors | ⬜ |
| **Errors** | Error handling | Friendly error on bad input | ⬜ |

## Studio Routes Reference

| Feature | Route |
|---------|-------|
| Agents | `/agents` |
| Agent Chat | `/agents/<id>/chat` |
| Workflows | `/workflows` |
| Tools | `/tools` |
| Evaluation | `/evaluation` |
| Scorers | `/evaluation?tab=scorers` |
| Observability | `/observability` |
| Logs | `/logs` |
| MCP Servers | `/mcps` |
| Settings | `/settings` |

## Environment-Specific References

| Reference | When to Use |
|-----------|-------------|
| `references/local-setup.md` | `--env local` |
| `references/cloud-deploy.md` | `--env staging` or `--env production` |
| `references/cloud-advanced.md` | Account, invites, RBAC, BYOK testing |
| `references/gcp-debugging.md` | Debugging cloud trace issues |
| `references/gateway-memory-testing.md` | Gateway memory/threads testing |

## Troubleshooting

**Browser tools not available (local)**
- Run `/browser` to configure browser support
- Enable with `/browser on`

**Server won't start**
- Verify `.env` has required API key
- Check if port 4111 is available
- Reinstall dependencies

**Agent chat fails**
- Verify API key is valid
- Check server logs for errors

**Traces missing (local)**
- Check `@mastra/observability` is installed
- Verify `telemetry` configured in `src/mastra/index.ts`
- Restart dev server after config changes

**Traces missing (cloud)**
- See `references/cloud-deploy.md` for trace verification
- See `references/gcp-debugging.md` for debugging

## Scripts

### `scripts/test-server.sh`

Test deployed server health and agent API:

```bash
.claude/skills/mastra-smoke-test/scripts/test-server.sh <server-url> [agent-id] [message]

# Examples
.claude/skills/mastra-smoke-test/scripts/test-server.sh https://my-app.server.staging.mastra.cloud
.claude/skills/mastra-smoke-test/scripts/test-server.sh https://my-app.server.mastra.cloud weather-agent "Weather in Tokyo?"
```

## Notes

- For local testing, this skill works with Stagehand or AgentBrowser browser providers
- For cloud testing, browser tools are optional (`--skip-browser` for curl-only)
- The `smoke-test` skill (different) uses Chrome MCP for external browser automation
