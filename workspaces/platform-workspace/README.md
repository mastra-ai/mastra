# @mastra/platform-workspace

Mastra Platform workspace provider. Gives agents environment-scoped sandbox execution and bucket-backed filesystem access through the Mastra Platform workspace proxy.

## Installation

```bash
npm install @mastra/platform-workspace
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';

const workspace = new Workspace({
  filesystem: new PlatformFilesystem({
    // accessToken, projectId, bucketName all fall back to env
  }),
  sandbox: new PlatformSandbox({
    // accessToken, projectId, environmentId all fall back to env
    idleTimeoutMinutes: 30,
    networkIsolation: 'ISOLATED',
  }),
});

const agent = new Agent({
  name: 'code-analyzer',
  model: 'anthropic/claude-sonnet-4-5',
  workspace,
});
```

## Documentation

- [@mastra/platform-workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/platform-workspace/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
