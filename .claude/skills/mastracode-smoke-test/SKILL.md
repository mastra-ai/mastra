---
name: mastracode-smoke-test
description: Create a Mastra project using create-mastra and smoke test the studio using MastraCode's built-in browser tools
model: claude-opus-4-5
---

# MastraCode Smoke Test Skill

Creates or uses an existing Mastra project and performs smoke testing of the Mastra Studio using MastraCode's built-in browser tools.

**This skill is for MastraCode with browser support enabled.** It works with either Stagehand or AgentBrowser providers. For Claude Code with external browser tools, use `smoke-test` instead.

## Usage

Activate this skill and provide the parameters:

```text
# Create new project
smoke test with directory ~/projects, name my-test-app, tag latest
smoke test -d ~/projects -n my-test-app -t alpha --pm pnpm --llm anthropic

# Use existing project
smoke test --existing-project ~/my-existing-app
smoke test --existing-project ~/my-app --tag alpha  # Updates deps to alpha

# Run specific test only
smoke test --existing-project ~/my-app --test agents
smoke test --existing-project ~/my-app --test traces
```

## Parameters

| Parameter            | Short | Description                                                                  | Required | Default  |
| -------------------- | ----- | ---------------------------------------------------------------------------- | -------- | -------- |
| `--directory`        | `-d`  | Parent directory where project will be created                               | *        | -        |
| `--name`             | `-n`  | Project name (will be created as subdirectory)                               | *        | -        |
| `--existing-project` |       | Path to existing Mastra project (mutually exclusive with --directory/--name) | *        | -        |
| `--tag`              | `-t`  | Version tag for create-mastra or dependency update (e.g., `latest`, `alpha`) | **       | `latest` |
| `--pm`               | `-p`  | Package manager: `npm`, `yarn`, `pnpm`, or `bun`                             | No       | `npm`    |
| `--llm`              | `-l`  | LLM provider: `openai`, `anthropic`, `groq`, `google`, `cerebras`, `mistral` | No       | `openai` |
| `--db`               |       | Storage backend: `libsql` (default), `pg`, `turso`                           | No       | `libsql` |
| `--test`             |       | Run specific test only: `agents`, `tools`, `workflows`, `traces`, `scorers`, `memory`, `mcp`, `errors` | No | (full) |
| `--browser-agent`    |       | Add a browser-enabled agent to the project for testing                       | No       | `false`  |

\* Either `--directory` + `--name` OR `--existing-project` is required
\** Required for new projects, optional for existing (updates deps when provided)

## Prerequisites

This skill requires MastraCode with browser support enabled via `/browser on`. Either browser provider works:

- **Stagehand** (AI-powered): Uses natural language actions
- **AgentBrowser** (deterministic): Uses explicit element refs

If browser tools are not available, run `/browser` to configure browser support.

## Execution Steps

### Step 1: Project Setup

**Option A: Create New Project**

Run the create-mastra command with explicit parameters to avoid interactive prompts:

```sh
# For npm
npx create-mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llmProvider> -e

# For yarn
yarn create mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llmProvider> -e

# For pnpm
pnpm create mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llmProvider> -e

# For bun
bunx create-mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llmProvider> -e
```

**Flags explained:**

- `-c agents,tools,workflows,scorers` - Include all components
- `-l <provider>` - Set the LLM provider
- `-e` - Include example code

Wait for the installation to complete. This may take 1-2 minutes.

**Option B: Use Existing Project**

```sh
cd <existing-project-path>
```

Verify it has:
- `package.json` with `@mastra/core`
- `src/mastra/index.ts` with a Mastra instance
- At least one agent configured

**If `--tag` is provided with existing project**, update dependencies:

```sh
# Update all @mastra/* packages to the specified tag
<pm> add @mastra/core@<tag> @mastra/memory@<tag> @mastra/libsql@<tag> mastra@<tag>

# Or for alpha/latest, use the tag directly
<pm> add @mastra/core@alpha @mastra/memory@alpha mastra@alpha
```

Only update packages that exist in the project's `package.json`.

### Storage Backend Selection (--db)

When using a non-default storage backend, additional setup is required after project creation:

| Backend | Package | Environment Variables |
|---------|---------|----------------------|
| `libsql` (default) | `@mastra/libsql` | None (local file) |
| `pg` | `@mastra/pg` | `DATABASE_URL` |
| `turso` | `@mastra/turso` | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |

**For PostgreSQL:**
```bash
# Add dependency
<pm> add @mastra/pg

# Update .env
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

**For Turso:**
```bash
# Add dependency
<pm> add @mastra/turso

# Update .env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

Then update `src/mastra/index.ts` to use the appropriate storage provider.

### Custom API Routes (Optional)

To test custom server routes, add a route to the project:

1. **Create `src/mastra/routes/hello.ts`**:

```typescript
import { registerApiRoute } from '@mastra/core/server';

export const helloRoute = registerApiRoute('/hello', {
  method: 'GET',
  handler: async (c) => {
    return c.json({ message: 'Hello from custom route!' });
  },
});
```

2. **Register in `src/mastra/index.ts`**:

```typescript
import { helloRoute } from './routes/hello';

export const mastra = new Mastra({
  // ... other config
  server: {
    routes: [helloRoute],
  },
});
```

3. **Test the route** after starting the dev server:

```bash
curl http://localhost:4111/hello
# Expected: {"message":"Hello from custom route!"}
```

### Step 2: Verify Project Structure

After creation, verify the project has:

- `package.json` with mastra dependencies
- `src/mastra/index.ts` exporting a Mastra instance
- `.env` file (may need to be created)

### Step 2.5: Add Browser Agent (--browser-agent)

**Skip this step if `--browser-agent` flag is NOT provided.**

To test browser functionality, add a browser-enabled agent:

1. **Install browser packages**:

```sh
<pm> add @mastra/stagehand @mastra/memory
# or for deterministic browser automation:
<pm> add @mastra/agent-browser @mastra/memory
```

2. **Create browser-agent.ts** in `src/mastra/agents/`:

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { StagehandBrowser } from '@mastra/stagehand';

export const browserAgent = new Agent({
  id: 'browser-agent',
  name: 'Browser Agent',
  instructions: `You are a helpful assistant that can browse the web to find information.`,
  model: '<provider>/<model>', // e.g., 'openai/gpt-4o'
  memory: new Memory(),
  browser: new StagehandBrowser({
    headless: false,
  }),
});
```

3. **Update index.ts** to register the browser agent:

```typescript
import { browserAgent } from './agents/browser-agent';

// In Mastra config:
agents: { weatherAgent, browserAgent },
```

### Step 3: Configure Environment Variables

Based on the selected LLM provider, check for the required API key:

| Provider  | Required Environment Variable  |
| --------- | ------------------------------ |
| openai    | `OPENAI_API_KEY`               |
| anthropic | `ANTHROPIC_API_KEY`            |
| groq      | `GROQ_API_KEY`                 |
| google    | `GOOGLE_GENERATIVE_AI_API_KEY` |
| cerebras  | `CEREBRAS_API_KEY`             |
| mistral   | `MISTRAL_API_KEY`              |

**Check in this order:**

1. **Check global environment first**: Run `echo $<ENV_VAR_NAME>` to see if the key is already set globally
2. **Check project `.env` file**: If not set globally, check if `.env` exists
3. **Ask user only if needed**: If the key is not available, ask the user

### Step 4: Start the Development Server

Navigate to the project directory and start the dev server:

```sh
cd <directory>/<project-name>
<packageManager> run dev
```

The server typically starts on `http://localhost:4111`. Wait for the server to be ready.

### Step 5: Smoke Test the Studio

Use the available browser tools to test the Mastra Studio. The instructions below are tool-agnostic - use whichever browser tools are available (Stagehand or AgentBrowser).

#### 5.1 Initial Navigation

Navigate to `http://localhost:4111`

#### 5.2 Test Checklist

Perform the following smoke tests:

**Navigation & Basic Loading**

- [ ] Navigate to `http://localhost:4111`
- [ ] Extract/snapshot the page to verify "Mastra Studio" or agents list appears
- [ ] Verify Studio loads successfully

**Agents Page** (`/agents`)

- [ ] Navigate to `/agents` (or click Agents link)
- [ ] Extract/snapshot to verify at least one agent is listed
- [ ] Note the agents available

**Agent Chat**

- [ ] Click on Weather Agent
- [ ] Type a test message: "What's the weather in Tokyo?"
- [ ] Click send button
- [ ] Extract/snapshot to verify response appears
- [ ] Confirm agent chat works

**Browser Agent** (`/agents/browser-agent/chat`) - only if `--browser-agent` was provided

- [ ] Navigate to the browser-agent
- [ ] Send a message: "Go to example.com and tell me what you see"
- [ ] Verify the agent launches a browser and extracts content
- [ ] Verify response includes page content (this is "browserception" - your browser watching the agent's browser!)

**Tools Page** (`/tools`)

- [ ] Navigate to `/tools`
- [ ] Extract/snapshot to verify tools list loads
- [ ] Click on `get-weather` tool
- [ ] Type "London" in city input
- [ ] Click Submit
- [ ] Extract/snapshot to verify JSON output with weather data

**Workflows Page** (`/workflows`)

- [ ] Navigate to `/workflows`
- [ ] Extract/snapshot to verify workflows list loads
- [ ] Click on `weather-workflow`
- [ ] Type "Berlin" in city input
- [ ] Click Run
- [ ] Extract/snapshot to verify workflow execution succeeds

**Evaluation/Scorers Page** (`/evaluation?tab=scorers`)

- [ ] Navigate to `/evaluation?tab=scorers`
- [ ] Extract/snapshot to verify scorers list loads (3 example scorers)

**Settings Page** (`/settings`)

- [ ] Navigate to `/settings`
- [ ] Extract/snapshot to verify settings page loads

**Observability - Traces** (`/observability`)

- [ ] Navigate to `/observability`
- [ ] Extract/snapshot to check for traces
- [ ] Verify traces from agent chat (Step 5.2) appear
- [ ] Click on a trace to view details
- [ ] Verify trace shows: agent name, input/output, duration, status

**Local Observability Setup Verification:**

Before testing traces, verify observability is configured:

1. **Check `src/mastra/index.ts`** for observability config:
```typescript
import { createLogger } from '@mastra/core/logger';
import { OtelConfig } from '@mastra/core/telemetry';

export const mastra = new Mastra({
  // ... agents, tools, etc.
  logger: createLogger({ name: 'my-app', level: 'info' }),
  telemetry: new OtelConfig({
    serviceName: 'my-app',
    enabled: true,
  }),
});
```

2. **Check dependencies** in `package.json`:
   - `@mastra/observability` should be installed

3. **Check dev server output** for OTel initialization:
   - Should see "OpenTelemetry initialized" or similar
   - Should NOT see "MASTRA_CLOUD_ACCESS_TOKEN not set" (that's only for cloud deploys)

If traces are missing locally:
- Verify `telemetry` is configured in Mastra instance
- Restart dev server after config changes
- Check browser console for OTel export errors

**Traces Verification Checklist:**

| Action | Expected Trace |
|--------|---------------|
| Agent chat | `agent run: 'weather-agent'` |
| Tool execution | `tool call: 'get-weather'` |
| Workflow run | `workflow run: 'weather-workflow'` |
| Scorer execution | `scorer run: '<scorer-name>'` (if scorers configured) |

If traces are missing:
1. Check that `@mastra/observability` is installed
2. Verify `observability` is configured in `src/mastra/index.ts`
3. Check browser console for export errors

**Logs Page** (`/logs`)

- [ ] Navigate to `/logs`
- [ ] Extract/snapshot to check for server logs
- [ ] Verify logs show recent activity

**MCP Servers Page** (`/mcps`)

- [ ] Navigate to `/mcps`
- [ ] Extract/snapshot to verify page loads (empty state OK)
- [ ] If MCP servers are configured in the project:
  - [ ] Verify MCP server appears in list
  - [ ] Check connection status (green = connected)
  - [ ] Verify tools from MCP server are discoverable

**Memory/Threads Testing**

Test that conversation history persists:

- [ ] Chat with an agent (e.g., Weather Agent)
- [ ] Send a follow-up message referencing the previous response
- [ ] Verify agent remembers context from previous message
- [ ] Navigate away from chat (e.g., to `/tools`)
- [ ] Navigate back to the agent chat
- [ ] Verify conversation history is preserved
- [ ] Send another message referencing earlier context
- [ ] Verify agent still has access to full thread history

**Error Handling Testing**

Test graceful error handling:

- [ ] In agent chat, send a request that will fail (e.g., ask about a city with special characters: "Weather in @#$%")
- [ ] Verify error message is user-friendly (not raw stack trace)
- [ ] In tools page, submit a tool with invalid input
- [ ] Verify tool returns a clear error message

#### 5.3 Cleanup

After testing:

- [ ] Close the browser session
- [ ] Stop the dev server if needed

#### 5.4 Report Results

Provide a summary:

- Total tests passed/failed
- Any errors encountered
- Recommendations for issues found

## Partial Testing (--test flag)

To test a specific flow only:

```bash
# Test just agents page and chat
smoke test --existing-project ~/my-app --test agents

# Test just tools page and execution
smoke test --existing-project ~/my-app --test tools

# Test just workflows
smoke test --existing-project ~/my-app --test workflows

# Test just traces/observability
smoke test --existing-project ~/my-app --test traces

# Test just scorers/evaluation
smoke test --existing-project ~/my-app --test scorers
```

### What each --test option covers

| Option | Tests Performed |
|--------|-----------------|
| `agents` | Navigate to `/agents`, list agents, chat with an agent |
| `tools` | Navigate to `/tools`, list tools, execute a tool |
| `workflows` | Navigate to `/workflows`, list workflows, run a workflow |
| `traces` | Navigate to `/observability`, verify traces appear from previous actions |
| `scorers` | Navigate to `/evaluation?tab=scorers`, verify scorers list |
| `memory` | Test conversation persistence, thread history, context recall |
| `mcp` | Navigate to `/mcps`, verify MCP servers and tool discovery |
| `errors` | Test error handling with invalid inputs |

**Note**: The `traces` test should be run after `agents`, `tools`, or `workflows` to have traces to verify.
**Note**: The `memory` test should be run after `agents` to have conversation history to verify.

## Test Verification Checklist

| Category | Test | Expected Result | Status |
|----------|------|-----------------|--------|
| **Setup** | Project created/found | Directory exists with package.json | ⬜ |
| **Setup** | Dependencies installed | node_modules present | ⬜ |
| **Setup** | Dev server starts | localhost:4111 accessible | ⬜ |
| **Agents** | Agent list loads | At least one agent shown | ⬜ |
| **Agents** | Agent chat works | Agent responds to message | ⬜ |
| **Tools** | Tool list loads | Tools displayed | ⬜ |
| **Tools** | Tool execution | Returns valid JSON output | ⬜ |
| **Workflows** | Workflow list loads | Workflows displayed | ⬜ |
| **Workflows** | Workflow run | Executes successfully | ⬜ |
| **Scorers** | Scorers list loads | Scorers displayed | ⬜ |
| **Traces** | Traces page loads | No errors | ⬜ |
| **Traces** | Agent traces visible | Traces from chat appear | ⬜ |
| **Traces** | Tool traces visible | Traces from tool calls appear | ⬜ |
| **Logs** | Logs page loads | Server logs visible | ⬜ |
| **Memory** | Thread persists | History preserved after navigation | ⬜ |
| **Memory** | Context recall | Agent remembers previous messages | ⬜ |
| **MCP** | MCP page loads | No errors | ⬜ |
| **MCP** | Server connection | MCP servers show connected status | ⬜ |
| **Errors** | Agent error handling | Friendly error on bad input | ⬜ |
| **Errors** | Tool error handling | Clear error message | ⬜ |

## Studio Routes Reference

| Feature         | Route                     |
| --------------- | ------------------------- |
| Agents          | `/agents`                 |
| Workflows       | `/workflows`              |
| Tools           | `/tools`                  |
| Evaluation      | `/evaluation`             |
| Scorers         | `/evaluation?tab=scorers` |
| Observability   | `/observability`          |
| Logs            | `/logs`                   |
| MCP Servers     | `/mcps`                   |
| Processors      | `/processors`             |
| Templates       | `/templates`              |
| Request Context | `/request-context`        |
| Settings        | `/settings`               |

## Troubleshooting

**Browser tools not available**

- Run `/browser` to configure browser support
- Ensure browser is enabled with `/browser on`
- Browser setting changes apply immediately; no restart required

**Server won't start**

- Verify `.env` has required API key
- Check if port 4111 is available
- Try reinstalling dependencies

**Agent chat fails**

- Verify API key is valid
- Check server logs for errors
- Ensure LLM provider API is accessible

**Browser agent fails**

- Ensure Playwright browsers are installed: `pnpm exec playwright install chromium`
- Check that no other browser instance is blocking

## Notes

- This skill works with both Stagehand (AI-powered) and AgentBrowser (deterministic) providers
- The test instructions are tool-agnostic - the agent will use whichever browser tools are available
- Browser agent testing creates "browserception" - your MastraCode browser watching the project's agent browser
- For external browser automation (Chrome MCP), use the `smoke-test` skill instead
