# AgentFS Workspace Example

Uses `@mastra/agentfs` to store files in a Turso/SQLite database via the Mastra Workspace API.

## Setup

```bash
cd examples/agentfs-workspace
pnpm i --ignore-workspace
```

## Run the demo

```bash
# All demos
pnpm demo

# Filesystem operations only (no API key needed)
pnpm demo:filesystem

# Agent demo (needs OPENAI_API_KEY)
OPENAI_API_KEY=sk-... pnpm demo:agents
```

## What's in here

### Filesystem demo (`--type filesystem`)

Exercises the AgentFS filesystem directly — no LLM calls, no API keys:

- Write, read, append files
- Create directories, list contents
- Copy, move, delete
- Stat (size, timestamps)
- Read-only filesystem enforcement

### Agent demo (`--type agents`)

An agent with an AgentFS-backed workspace. The agent gets workspace tools automatically (`mastra_workspace_read_file`, `mastra_workspace_write_file`, etc.) and can read/write files in its SQLite database.

Requires `OPENAI_API_KEY` for the generation step.

## How it works

```typescript
import { AgentFSFilesystem } from '@mastra/agentfs';
import { Workspace } from '@mastra/core/workspace';
import { Agent } from '@mastra/core/agent';

// Create a workspace backed by AgentFS
const workspace = new Workspace({
  filesystem: new AgentFSFilesystem({
    agentId: 'my-agent',  // stores at .agentfs/my-agent.db
  }),
});

// Use directly
await workspace.init();
await workspace.filesystem.writeFile('/hello.txt', 'Hello!');
const content = await workspace.filesystem.readFile('/hello.txt', { encoding: 'utf-8' });

// Or attach to an agent — tools are injected automatically
const agent = new Agent({
  id: 'my-agent',
  model: 'openai/gpt-4o-mini',
  workspace,
});
```

### AgentFSFilesystem options

| Option | Description |
|--------|-------------|
| `agentId` | Agent ID — creates database at `.agentfs/<agentId>.db` |
| `path` | Explicit database file path (alternative to `agentId`) |
| `agent` | Pre-opened `AgentFS` instance (caller manages lifecycle) |
| `readOnly` | Block write operations (default: `false`) |
| `displayName` | Human-friendly name for the UI |
| `icon` | Icon identifier (default: `'database'`) |

You must provide at least one of `agentId`, `path`, or `agent`.

## File structure

```text
src/
  mastra/
    index.ts              # Mastra instance
    workspaces.ts         # Workspace configurations
    agents/
      notes-agent.ts      # Agent with AgentFS workspace
      index.ts
  demo/
    index.ts              # Demo script
```
