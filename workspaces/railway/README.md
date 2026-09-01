# @mastra/railway

Railway cloud sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface using [Railway Sandboxes](https://docs.railway.com/sandboxes) — ephemeral, isolated Linux VMs provisioned on demand through Railway's TypeScript SDK. Supports command execution with streaming output, command timeouts, configurable idle timeout, network isolation, and reattaching to an existing sandbox.

## Installation

```bash
npm install @mastra/railway
```

## Usage

### Basic

```typescript
import { Workspace } from '@mastra/core/workspace';
import { RailwaySandbox } from '@mastra/railway';

const sandbox = new RailwaySandbox({
  // token + environmentId read from RAILWAY_API_TOKEN / RAILWAY_ENVIRONMENT_ID
  idleTimeoutMinutes: 30,
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
console.log(result.stdout); // "Hello!"

await workspace.destroy();
```

## Documentation

- [Railway integration guide](https://mastra.ai/integrations/sandboxes/railway)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/railway/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
