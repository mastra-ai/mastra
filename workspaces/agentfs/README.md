# @mastra/agentfs

AgentFS (Turso/SQLite-backed) filesystem provider for Mastra workspaces. Stores files in a local SQLite database via the agentfs-sdk, giving agents persistent storage that survives across sessions.

## Installation

```bash
npm install @mastra/agentfs
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { AgentFSFilesystem } from '@mastra/agentfs';

const workspace = new Workspace({
  filesystem: new AgentFSFilesystem({
    agentId: 'my-agent', // stores at .agentfs/my-agent.db
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

### Using an explicit database path

```typescript
const workspace = new Workspace({
  filesystem: new AgentFSFilesystem({
    path: '/data/my-agent.db',
  }),
});
```

### Using a pre-opened AgentFS instance

```typescript
import { AgentFS } from 'agentfs-sdk';
import { AgentFSFilesystem } from '@mastra/agentfs';

const agent = await AgentFS.open({ id: 'my-agent' });

const workspace = new Workspace({
  filesystem: new AgentFSFilesystem({
    agent, // caller manages open/close
  }),
});
```

## Documentation

For more information, see the [Mastra Workspaces documentation](https://mastra.ai/docs/workspace/overview).
