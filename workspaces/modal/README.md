# @mastra/modal

Modal cloud sandbox provider for Mastra workspaces. Use `@mastra/modal` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/modal
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { ModalSandbox } from '@mastra/modal';

const sandbox = new ModalSandbox({
  id: 'dev-sandbox',
  baseImage: 'ubuntu:22.04',
  timeoutMs: 60_000,
});
```

## Documentation

- [@mastra/modal documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/modal/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
