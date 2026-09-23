# @mastra/e2b-desktop

E2B Desktop (computer-use) sandbox provider for Mastra workspaces.

Runs a full Linux desktop environment in an [E2B](https://e2b.dev) cloud sandbox with screenshot, mouse, and keyboard control. Extends [`@mastra/e2b`](../e2b)'s `E2BSandbox` the same way [`@e2b/desktop`](https://github.com/e2b-dev/desktop)'s SDK extends `e2b`'s — everything the base provider supports (command execution, processes, file upload, pause/resume reconnection) works against the same desktop VM.

## Installation

```bash
npm install @mastra/e2b-desktop
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { E2BDesktopSandbox } from '@mastra/e2b-desktop';

const sandbox = new E2BDesktopSandbox({ resolution: [1280, 720] });

const agent = new Agent({
  name: 'desktop-agent',
  instructions: 'You can control a Linux desktop and run shell commands.',
  model: 'anthropic/claude-sonnet-4-6',
  // file + shell + computer tools are all emitted automatically
  workspace: new Workspace({ sandbox }),
});
```

## Documentation

- [E2B Desktop integration guide](https://mastra.ai/integrations/sandboxes/e2b-desktop)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/e2b-desktop/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
