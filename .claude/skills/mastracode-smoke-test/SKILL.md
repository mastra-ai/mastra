---
name: mastracode-smoke-test
description: Create a Mastra project using create-mastra and smoke test the studio using MastraCode's built-in browser tools
model: claude-opus-4-5
---

# MastraCode Smoke Test Skill

Creates a new Mastra project using `create-mastra@<tag>` and performs smoke testing of the Mastra Studio using MastraCode's built-in browser tools.

**This skill is for MastraCode with browser support enabled.** It works with either Stagehand or AgentBrowser providers. For Claude Code with external browser tools, use `smoke-test` instead.

## Usage

Activate this skill and provide the parameters:

```
smoke test with directory ~/projects, name my-test-app, tag latest
smoke test -d ~/projects -n my-test-app -t alpha --pm pnpm --llm anthropic
```

## Parameters

| Parameter     | Short | Description                                                                  | Required | Default  |
| ------------- | ----- | ---------------------------------------------------------------------------- | -------- | -------- |
| `--directory` | `-d`  | Parent directory where project will be created                               | **Yes**  | -        |
| `--name`      | `-n`  | Project name (will be created as subdirectory)                               | **Yes**  | -        |
| `--tag`       | `-t`  | Version tag for create-mastra (e.g., `latest`, `alpha`, `0.10.6`)            | **Yes**  | -        |
| `--pm`        | `-p`  | Package manager: `npm`, `yarn`, `pnpm`, or `bun`                             | No       | `npm`    |
| `--llm`       | `-l`  | LLM provider: `openai`, `anthropic`, `groq`, `google`, `cerebras`, `mistral` | No       | `openai` |

## Prerequisites

This skill requires MastraCode with browser support enabled via `/browser on`. Either browser provider works:

- **Stagehand** (AI-powered): Uses natural language actions
- **AgentBrowser** (deterministic): Uses explicit element refs

If browser tools are not available, run `/browser` to configure browser support.

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

Wait for the installation to complete. This may take 1-2 minutes.

### Step 2: Verify Project Structure

After creation, verify the project has:

- `package.json` with mastra dependencies
- `src/mastra/index.ts` exporting a Mastra instance
- `.env` file (may need to be created)

### Step 2.5: Add Agent Network for Network Mode Testing

To enable Network mode testing, add an agent network configuration:

1. **Create activity-agent.ts** in `src/mastra/agents/`:

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

export const activityAgent = new Agent({
  id: 'activity-agent',
  name: 'Activity Agent',
  instructions: `You are a helpful activity planning assistant that suggests activities based on weather conditions.`,
  model: '<provider>/<model>', // e.g., 'openai/gpt-4o'
  memory: new Memory(),
});
```

2. **Create planner-network.ts** in `src/mastra/agents/`:

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { weatherAgent } from './weather-agent';
import { activityAgent } from './activity-agent';

export const plannerNetwork = new Agent({
  id: 'planner-network',
  name: 'Planner Network',
  instructions: `You are a coordinator that manages weather and activity agents.`,
  model: '<provider>/<model>',
  agents: { weatherAgent, activityAgent }, // This makes it a network agent
  memory: new Memory(),
});
```

3. **Update index.ts** to register the new agents:

```typescript
import { activityAgent } from './agents/activity-agent';
import { plannerNetwork } from './agents/planner-network';

// In Mastra config:
agents: { weatherAgent, activityAgent, plannerNetwork },
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

**Network Mode** (if planner-network was added)

- [ ] Navigate to `/agents/planner-network/chat`
- [ ] Select "Network" mode if available
- [ ] Send: "What activities can I do in Paris based on the weather?"
- [ ] Extract/snapshot to verify network coordination response

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

**Observability Page** (`/observability/traces`)

- [ ] Navigate to `/observability/traces`
- [ ] Extract/snapshot to check for traces (may be empty initially)

**MCP Servers Page** (`/mcps`)

- [ ] Navigate to `/mcps`
- [ ] Extract/snapshot to verify page loads (empty state OK)

#### 5.3 Cleanup

After testing:

- [ ] Close the browser session
- [ ] Stop the dev server if needed

#### 5.4 Report Results

Provide a summary:

- Total tests passed/failed
- Any errors encountered
- Recommendations for issues found

## Studio Routes Reference

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

## Troubleshooting

**Browser tools not available**

- Run `/browser` to configure browser support
- Ensure browser is enabled with `/browser on`
- Restart MastraCode after changing browser settings

**Server won't start**

- Verify `.env` has required API key
- Check if port 4111 is available
- Try reinstalling dependencies

**Agent chat fails**

- Verify API key is valid
- Check server logs for errors
- Ensure LLM provider API is accessible

## Notes

- This skill works with both Stagehand (AI-powered) and AgentBrowser (deterministic) providers
- The test instructions are tool-agnostic - the agent will use whichever browser tools are available
- For external browser automation (Chrome MCP), use the `smoke-test` skill instead
