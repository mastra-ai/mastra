# @mastra/mesa

Mesa filesystem provider for Mastra workspaces. Use `@mastra/mesa` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/mesa
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { MesaFilesystem } from '@mastra/mesa';

const workspace = new Workspace({
  filesystem: new MesaFilesystem({
    apiKey: process.env.MESA_API_KEY,
    org: 'acme',
    repos: [{ name: 'docs', bookmark: 'main' }],
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'openai/gpt-5.6-sol',
  workspace,
});
```

## Documentation

- [@mastra/mesa documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/mesa/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
