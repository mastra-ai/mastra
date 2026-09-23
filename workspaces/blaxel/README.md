# @mastra/blaxel

Blaxel cloud sandbox provider for Mastra workspaces. Provides secure, isolated code execution environments with support for mounting cloud storage (S3, GCS) via FUSE.

## Installation

```bash
npm install @mastra/blaxel
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { BlaxelSandbox } from '@mastra/blaxel';

const workspace = new Workspace({
  sandbox: new BlaxelSandbox({
    timeout: '5m', // sandbox TTL (default: 5 minutes)
    memory: 4096, // memory in MB (default: 4096)
    region: 'auto', // region selection (default: BL_REGION or auto)
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

## Documentation

- [Blaxel integration guide](https://mastra.ai/integrations/sandboxes/blaxel)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/blaxel/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
