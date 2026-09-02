# @mastra/agentfs

AgentFS (Turso/SQLite-backed) filesystem provider for Mastra workspaces. Stores files in a local SQLite database via the agentfs-sdk, giving agents persistent storage that survives across sessions.

## Installation

```bash
npm install @mastra/agentfs
```

## Usage

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

- [AgentFS integration guide](https://mastra.ai/integrations/file-storage/agentfs)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/agentfs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
