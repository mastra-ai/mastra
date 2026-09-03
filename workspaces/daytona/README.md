# @mastra/daytona

Daytona cloud sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface using [Daytona](https://www.daytona.io/) sandboxes. Supports multiple runtimes, resource configuration, volumes, snapshots, streaming output, sandbox reconnection, and filesystem mounting (S3, GCS, Azure Blob).

## Installation

```bash
npm install @mastra/daytona
```

## Usage

### Basic

```typescript
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

const sandbox = new DaytonaSandbox({
  language: 'typescript',
  timeout: 60_000,
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
console.log(result.stdout); // "Hello!"

await workspace.destroy();
```

## Documentation

- [Daytona integration guide](https://mastra.ai/integrations/sandboxes/daytona)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/daytona/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
