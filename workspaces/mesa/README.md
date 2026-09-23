# @mastra/mesa

Store versioned Mastra workspace files in Mesa repositories with standard file operations, commits, branches, diffs, history, and repository status.

## Installation

```bash
npm install @mastra/mesa
```

## Usage

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
  model: 'anthropic/claude-opus-4-7',
  workspace,
});
```

## Documentation

- [Mesa](https://mastra.ai/integrations/file-storage/mesa)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/mesa/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
