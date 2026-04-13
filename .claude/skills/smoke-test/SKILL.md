---
name: smoke-test
description: Create a Mastra project using create-mastra and smoke test the studio in Chrome using Chrome MCP server
model: claude-opus-4-5
---

# Smoke Test Skill

Creates a new Mastra project using `create-mastra@<tag>` and performs smoke testing of the Mastra Studio in Chrome.

**This skill is for Claude Code with Chrome MCP server.** For MastraCode with built-in browser tools, use `mastracode-smoke-test` instead.

## Usage

```
/smoke-test --directory <path> --name <project-name> --tag <version> [--pm <package-manager>] [--llm <provider>]
/smoke-test -d <path> -n <project-name> -t <version> [-p <package-manager>] [-l <provider>]
```

## Parameters

| Parameter     | Short | Description                                                                  | Required | Default  |
| ------------- | ----- | ---------------------------------------------------------------------------- | -------- | -------- |
| `--directory` | `-d`  | Parent directory where project will be created                               | **Yes**  | -        |
| `--name`      | `-n`  | Project name (will be created as subdirectory)                               | **Yes**  | -        |
| `--tag`       | `-t`  | Version tag for create-mastra (e.g., `latest`, `alpha`, `0.10.6`)            | **Yes**  | -        |
| `--pm`        | `-p`  | Package manager: `npm`, `yarn`, `pnpm`, or `bun`                             | No       | `npm`    |
| `--llm`       | `-l`  | LLM provider: `openai`, `anthropic`, `groq`, `google`, `cerebras`, `mistral` | No       | `openai` |

## Examples

```sh
# Minimal (required params only)
/smoke-test -d ~/projects -n my-test-app -t latest

# Full specification
/smoke-test --directory ~/projects --name my-test-app --tag alpha --pm pnpm --llm anthropic

# Using short flags
/smoke-test -d ./projects -n smoke-test-app -t 0.10.6 -p bun -l openai
```

## Step 0: Parameter Validation (MUST RUN FIRST)

**CRITICAL**: Before proceeding, parse the ARGUMENTS and validate:

1. **Parse arguments** from the ARGUMENTS string provided above
2. **Check required parameters**:
   - `--directory` or `-d`: REQUIRED - fail if missing
   - `--name` or `-n`: REQUIRED - fail if missing
   - `--tag` or `-t`: REQUIRED - fail if missing
3. **Apply defaults** for optional parameters:
   - `--pm` or `-p`: Default to `npm` if not provided
   - `--llm` or `-l`: Default to `openai` if not provided
4. **Validate values**:
   - `pm` must be one of: `npm`, `yarn`, `pnpm`, `bun`
   - `llm` must be one of: `openai`, `anthropic`, `groq`, `google`, `cerebras`, `mistral`
   - `directory` must exist (or will be created)
   - `name` should be a valid directory name (no spaces, special chars)

**If validation fails**: Stop and show usage help with the missing/invalid parameters.

**If `-h` or `--help` is passed**: Show this usage information and stop.

## Prerequisites

This skill requires the **Chrome MCP server** (Claude-in-Chrome) for browser automation. Ensure it's configured and running.

The Chrome MCP server provides tools like `tabs_create_mcp`, `tabs_context_mcp`, `navigate_mcp`, `click_mcp`, `type_mcp`, and `screenshot_mcp`.

## Execution Steps

### Step 1: Create the Mastra Project

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

Being explicit with all parameters ensures the CLI runs non-interactively.

Wait for the installation to complete. This may take 1-2 minutes depending on network speed.

### Step 2: Verify Project Structure

After creation, verify the project has:

- `package.json` with mastra dependencies
- `src/mastra/index.ts` exporting a Mastra instance
- `.env` file (may need to be created)

### Step 2.5: Add Browser Agent for Browser Testing

To test browser functionality, add a browser-enabled agent:

1. **Install browser packages**:

```sh
<pm> add @mastra/stagehand
# or for deterministic browser automation:
<pm> add @mastra/agent-browser
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
   - If set globally, the project will inherit it - no `.env` file needed
   - Skip to Step 4

2. **Check project `.env` file**: If not set globally, check if `.env` exists in the project and contains the key

3. **Ask user only if needed**: If the key is not available globally or in `.env`:
   - Ask the user for the API key
   - Create the `.env` file with the provided key

**Only check for the ONE key matching the selected provider** - don't check for all providers.

### Step 4: Start the Development Server

Navigate to the project directory and start the dev server:

```sh
cd <directory>/<project-name>
<packageManager> run dev
```

The server typically starts on `http://localhost:4111`. Wait for the server to be ready before proceeding.

### Step 5: Smoke Test the Studio

Use the Chrome browser automation tools to test the Mastra Studio.

#### 5.1 Initial Setup

1. Get browser context using `tabs_context_mcp`
2. Create a new tab using `tabs_create_mcp`
3. Navigate to `http://localhost:4111`

#### 5.2 Test Checklist

Perform the following smoke tests using the Chrome automation tools:

**Navigation & Basic Loading**

- [ ] Studio loads successfully (page contains "Mastra Studio" or shows agents list)
- [ ] Take a screenshot of the home page

**Agents Page** (`/agents`)

- [ ] Navigate to agents page
- [ ] Verify at least one agent is listed (the example agent from `--default`)
- [ ] Take a screenshot

**Agent Detail** (`/agents/<agentId>/chat`)

- [ ] Click on an agent to view details
- [ ] Verify the agent overview panel loads
- [ ] Verify model settings panel is visible
- [ ] Take a screenshot

**Agent Chat**

- [ ] Send a test message to the agent (e.g., "What's the weather in Tokyo?")
- [ ] Wait for response
- [ ] Verify response appears in the chat
- [ ] Take a screenshot of the conversation

**Browser Agent** (`/agents/browser-agent/chat`) - if browser agent was added

- [ ] Navigate to the browser-agent
- [ ] Send a message: "Go to example.com and tell me what you see"
- [ ] Verify the agent launches a browser and extracts content
- [ ] Verify response includes page content
- [ ] Take a screenshot

**Tools Page** (`/tools`)

- [ ] Navigate to tools page
- [ ] Verify tools list loads (should show get-weather tool)
- [ ] Take a screenshot

**Tool Execution** (`/tools/get-weather`)

- [ ] Click on the get-weather tool to open detail page
- [ ] Find the city input field and enter a test city (e.g., "Tokyo")
- [ ] Click Submit button
- [ ] Wait for execution to complete
- [ ] Verify JSON output appears with weather data (temp, condition, etc.)
- [ ] Take a screenshot

**Workflows Page** (`/workflows`)

- [ ] Navigate to workflows page
- [ ] Verify workflows list loads (should show weather-workflow)
- [ ] Take a screenshot

**Workflow Execution** (`/workflows/weather-workflow`)

- [ ] Click on the weather-workflow to open detail page
- [ ] Verify visual graph displays (shows workflow steps)
- [ ] Find the city input field and enter a test city (e.g., "London")
- [ ] Click Run button
- [ ] Wait for execution to complete
- [ ] Verify steps show success (green checkmarks)
- [ ] Click to view JSON output modal
- [ ] Verify execution details with timing appear
- [ ] Take a screenshot

**Settings Page** (`/settings`)

- [ ] Navigate to settings page
- [ ] Verify settings page loads
- [ ] Take a screenshot

**Observability Page** (`/observability`)

- [ ] Navigate to observability page
- [ ] Verify traces list shows recent activity (from previous tests)
- [ ] Click on a trace to view details
- [ ] Verify timeline view shows steps and timing
- [ ] Take a screenshot

**Scorers Page** (`/evaluation?tab=scorers`)

- [ ] Navigate to `/evaluation?tab=scorers` (NOT `/scorers` - that route doesn't exist)
- [ ] Verify scorers list loads (shows 3 example scorers)
- [ ] Take a screenshot

**Additional Pages (verify load only)**

- [ ] Templates page (`/templates`) - Gallery of starter templates
- [ ] Request Context page (`/request-context`) - JSON editor
- [ ] Processors page (`/processors`) - Empty state OK
- [ ] MCP Servers page (`/mcps`) - Empty state OK

#### 5.3 Report Results

After completing all tests, provide a summary:

- Total tests passed/failed
- Any errors encountered
- Screenshots captured
- Recommendations for issues found

## Quick Reference

| Step           | Action                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Create Project | `cd <directory> && npx create-mastra@<tag> <name> -c agents,tools,workflows,scorers -l <provider> -e` |
| Install Deps   | Automatic during creation                                                                             |
| Set Env Vars   | Check global env first, then `.env`, ask user only if needed                                          |
| Start Server   | `cd <directory>/<name> && npm run dev`                                                                |
| Studio URL     | `http://localhost:4111`                                                                               |

## Troubleshooting

**Server won't start**

- Verify `.env` has required API key
- Check if port 4111 is available
- Try `<pm> install` to reinstall dependencies

**Browser can't connect**

- Wait a few seconds for server to fully start
- Check terminal for server ready message
- Verify no firewall blocking localhost

**Agent chat fails**

- Verify API key is valid
- Check server logs for errors
- Ensure LLM provider API is accessible

**Browser agent fails**

- Ensure Playwright browsers are installed: `pnpm exec playwright install chromium`
- Check that no other browser instance is blocking

## Studio Routes

| Feature         | Route                     |
| --------------- | ------------------------- |
| Agents          | `/agents`                 |
| Workflows       | `/workflows`              |
| Tools           | `/tools`                  |
| Evaluation      | `/evaluation`             |
| Scorers         | `/evaluation?tab=scorers` |
| Observability   | `/observability/traces`   |
| Logs            | `/observability/logs`     |
| MCP Servers     | `/mcps`                   |
| Processors      | `/processors`             |
| Templates       | `/templates`              |
| Request Context | `/request-context`        |
| Settings        | `/settings`               |

## Notes

- The `-e` flag includes example agents, making smoke testing meaningful
- If the user doesn't specify an LLM provider, default to OpenAI as it's most common
- Take screenshots at each major step for documentation/debugging
- Keep the dev server running in the background during testing
- Always use explicit flags (`-c`, `-l`, `-e`) to ensure non-interactive execution
- Browser agent testing validates the new browser automation features
- Observability traces appear automatically after running agents or workflows
