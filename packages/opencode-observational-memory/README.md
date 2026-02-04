# opencode-observational-memory

OpenCode plugin for persistent memory using [Mastra's Observational Memory](https://mastra.ai) system.

Your agent maintains context across long coding sessions - automatically compressing conversation history into structured observations.

## Installation

### For Humans

```bash
npx opencode-observational-memory install
```

Then configure your Mastra connection:

```bash
export MASTRA_URL="http://localhost:3000"
export MASTRA_AGENT_ID="your-agent-id"
export MASTRA_API_KEY="your-api-key"  # optional
```

**Or let your agent do it** - paste this into OpenCode:
```
Install opencode-observational-memory by following https://raw.githubusercontent.com/mastra-ai/mastra/main/packages/opencode-observational-memory/README.md
```

### For LLM Agents

<details>
<summary>Instructions for LLM Agents (click to expand)</summary>

If you're an LLM agent helping set up opencode-observational-memory, follow these steps:

#### Step 1: Run the installer

```bash
npx opencode-observational-memory install --no-tui --mastra-url http://localhost:3000 --agent-id your-agent-id
```

This will:
- Register the plugin in `~/.config/opencode/opencode.jsonc`
- Create the `/om-init` and `/om-status` commands
- Create `~/.config/opencode/observational-memory.jsonc` config

#### Step 2: Verify the config

```bash
cat ~/.config/opencode/opencode.jsonc
```

Should contain:
```json
{
  "plugin": ["opencode-observational-memory"]
}
```

#### Step 3: Configure Mastra connection

Either set environment variables:

```bash
export MASTRA_URL="http://your-mastra-server:3000"
export MASTRA_AGENT_ID="your-agent-id"
export MASTRA_API_KEY="your-api-key"  # optional
```

Or edit `~/.config/opencode/observational-memory.jsonc`:

```jsonc
{
  "mastraUrl": "http://your-mastra-server:3000",
  "agentId": "your-agent-id",
  "apiKey": "your-api-key"  // optional
}
```

#### Step 4: Verify setup

Tell the user to restart OpenCode and run:

```bash
opencode -c
```

They should see `observational-memory` in the tools list.

</details>

## Features

### Automatic Context Injection

On first message, the agent receives (invisible to user):
- Active observations from previous conversations
- Working memory state
- Any buffered observations pending consolidation

Example of what the agent sees:
```
[MASTRA OBSERVATIONAL MEMORY]

## Observational Memory

The following observations were extracted from previous conversations:

- Project uses TypeScript with strict mode
- Build command: pnpm build
- Uses Vitest for testing
- Prefer functional components over class components

---

## Working Memory

Source: resource

Current task: Implementing the auth module
Last discussion: Rate limiting strategy

[/MASTRA OBSERVATIONAL MEMORY]
```

The agent uses this context automatically - no manual prompting needed.

### Keyword Detection

Say "remember", "save this", "don't forget" etc. and the agent will be prompted to save to working memory.

```
You: "Remember that this project uses bun"
Agent: [updates working memory]
```

### How Observational Memory Works

Mastra's Observational Memory uses a three-agent architecture:

1. **Actor** (your main agent): Sees observations + recent unobserved messages
2. **Observer**: Automatically extracts observations when history exceeds token threshold
3. **Reflector**: Condenses observations when they grow too large

This keeps your agent's context focused and relevant, even across very long conversations.

## Tool Usage

The `observational-memory` tool is available to the agent:

| Mode | Args | Description |
|------|------|-------------|
| `status` | - | Check memory system status |
| `search` | `query`, `threadId?`, `limit?` | Search memories semantically |
| `list-threads` | `limit?` | List conversation threads |
| `list-messages` | `threadId`, `limit?` | List messages in a thread |
| `get-observations` | `threadId?` | View current observations |
| `get-working-memory` | `threadId` | Get working memory |
| `update-working-memory` | `threadId`, `content` | Update working memory |

## Memory Scoping

| Scope | Description |
|-------|-------------|
| Resource | Observations shared across all threads for a user (default) |
| Thread | Observations specific to a single conversation |

The scope is configured on your Mastra agent.

## Configuration

Create `~/.config/opencode/observational-memory.jsonc`:

```jsonc
{
  // Mastra server URL (can also use MASTRA_URL env var)
  "mastraUrl": "http://localhost:3000",

  // Agent ID for memory operations (can also use MASTRA_AGENT_ID env var)
  "agentId": "your-agent-id",

  // API key (can also use MASTRA_API_KEY env var)
  "apiKey": "your-api-key",

  // Max observations injected per request
  "maxObservations": 5,

  // Max search results returned
  "maxSearchResults": 10,

  // Include working memory in context
  "injectWorkingMemory": true,

  // Include observations in context
  "injectObservations": true,

  // Extra keyword patterns for memory detection (regex)
  "keywordPatterns": ["log\\s+this", "write\\s+down"],

  // Context usage ratio that triggers compaction (0-1)
  "compactionThreshold": 0.80
}
```

Environment variables take precedence over config file values.

## Privacy

```
API key is <private>sk-abc123</private>
```

Content in `<private>` tags is never stored in working memory.

## Setting Up Mastra

This plugin requires a running Mastra server with an agent configured with Observational Memory.

### Quick Start with Mastra

1. Install Mastra:
```bash
npx create-mastra my-mastra-app
cd my-mastra-app
```

2. Configure an agent with Observational Memory in `src/mastra/agents/index.ts`:

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { ObservationalMemory } from '@mastra/memory/processors';
import { PgMemory } from '@mastra/pg';

const memory = new Memory({
  storage: new PgMemory({ connectionString: process.env.DATABASE_URL }),
  processors: [
    new ObservationalMemory({
      model: 'google/gemini-2.5-flash',
      scope: 'resource',
    }),
  ],
});

export const myAgent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful coding assistant.',
  model: 'openai/gpt-4o',
  memory,
});
```

3. Start the server:
```bash
pnpm dev
```

4. Install this plugin:
```bash
npx opencode-observational-memory install
```

## Commands

After installation, these commands are available in OpenCode:

- `/om-init` - Initialize memory with codebase knowledge
- `/om-status` - Check memory status and view observations

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
```

Local install for testing:

```jsonc
{
  "plugin": ["file:///path/to/opencode-observational-memory"]
}
```

## Logs

```bash
tail -f ~/.opencode-observational-memory.log
```

## License

MIT
