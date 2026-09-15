# @mastra/e2b

E2B cloud sandbox provider for Mastra workspaces. Provides secure, isolated code execution environments with support for mounting cloud storage.

## Installation

```bash
npm install @mastra/e2b
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';

const workspace = new Workspace({
  sandbox: new E2BSandbox({
    apiKey: 'my-api-key', // falls back to E2B_API_KEY env var
    timeout: 60_000, // 60 second timeout (default: 5 minutes)
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

## Documentation

- [E2B integration guide](https://mastra.ai/integrations/sandboxes/e2b)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/e2b/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
