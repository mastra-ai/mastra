# @mastra/apple-container

Apple container CLI sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface with Apple's [`container`](https://github.com/apple/container) CLI. The provider starts a long-lived OCI Linux container and runs workspace commands through `container exec`.

## Installation

```bash
npm install @mastra/apple-container
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { AppleContainerSandbox } from '@mastra/apple-container';

const sandbox = new AppleContainerSandbox({
  image: 'node:22-slim',
  volumes: {
    '/Users/me/project': '/workspace',
  },
  workingDir: '/workspace',
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox?.executeCommand?.('node', ['--version']);
console.log(result?.stdout);

await workspace.destroy();
```

## Documentation

- [Apple Container integration guide](https://mastra.ai/integrations/sandboxes/apple-container)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/apple-container/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
