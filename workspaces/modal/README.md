# @mastra/modal

Run Mastra workspace commands in isolated Modal cloud sandboxes with authentication, lifecycle controls, background processes, and reconnection.

## Installation

```bash
npm install @mastra/modal
```

## Usage

Set `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`, then attach the sandbox to a workspace.

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { ModalSandbox } from '@mastra/modal';

const workspace = new Workspace({
  sandbox: new ModalSandbox({
    id: 'dev-sandbox',
    baseImage: 'ubuntu:22.04',
    timeoutMs: 60_000,
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

## Documentation

- [Modal](https://mastra.ai/integrations/sandboxes/modal)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/modal/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
