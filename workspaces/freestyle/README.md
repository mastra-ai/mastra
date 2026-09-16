# @mastra/freestyle

Run Mastra workspace commands in powerful, persistent, hardware-virtualized Freestyle Linux VMs. The provider reconnects by stable VM slug, pauses without discarding memory or disk, and exposes the underlying Freestyle SDK handle for snapshots, private networking, PTYs, and VM sizing.

## Installation

```bash
npm install @mastra/freestyle
```

## Usage

Set `FREESTYLE_API_KEY`, then attach the sandbox to a workspace.

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { FreestyleSandbox } from '@mastra/freestyle';

const workspace = new Workspace({
  sandbox: new FreestyleSandbox({
    id: 'developer-agent',
    workingDirectory: '/workspace',
  }),
});

const agent = new Agent({
  id: 'developer-agent',
  name: 'Developer agent',
  instructions: 'Use the workspace to inspect and modify the project.',
  model: 'openai/gpt-5.6-sol',
  workspace,
});
```

`stop()` pauses the VM and preserves its state. `start()` reconnects to the same VM by `id`, while `destroy()` permanently deletes it.

## Documentation

- [Freestyle](https://mastra.ai/integrations/sandboxes/freestyle)
- [Freestyle VM documentation](https://www.freestyle.sh/docs)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/freestyle/CHANGELOG.md) for version history and release notes.

## Support

Join the [Mastra Discord](https://discord.gg/mastra-ai) for help with the integration.
