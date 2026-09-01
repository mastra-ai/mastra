# @mastra/agentfs

AgentFS (Turso/SQLite-backed) filesystem provider for Mastra workspaces. Use `@mastra/agentfs` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/agentfs
```

## Usage

Configure the prerequisites described in the documentation.

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

- [@mastra/agentfs documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/agentfs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
