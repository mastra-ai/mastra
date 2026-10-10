# @mastra/sprites

Fly.io Sprites sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface using [Fly.io Sprites](https://sprites.dev) — persistent Linux VMs that keep their filesystem between runs and hibernate when idle — through the official `@fly/sprites` SDK. Supports get-or-create by Sprite name, command execution with streaming output, timeouts and cancellation, background processes with stdin, and checkpoint capture.

Requires Node.js 24 or later.

## Installation

```bash
npm install @mastra/sprites
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { SpritesSandbox } from '@mastra/sprites';

const sandbox = new SpritesSandbox({
  id: 'mastra-project',
  // token read from SPRITES_TOKEN
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
console.log(result.stdout); // "Hello!"

// stop() keeps the Sprite and its files; destroy() deletes it.
await sandbox.destroy();
```

## Documentation

- [Fly.io Sprites integration guide](https://mastra.ai/integrations/sandboxes/sprites)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)
