# @mastra/daytona

Daytona cloud sandbox provider for Mastra workspaces. Use `@mastra/daytona` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/daytona
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

const sandbox = new DaytonaSandbox({
  language: 'typescript',
  timeout: 60_000,
});

const workspace = new Workspace({ sandbox });
await workspace.init();
```

## Documentation

- [@mastra/daytona documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/daytona/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
