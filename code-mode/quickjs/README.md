# @mastra/quickjs

In-process WebAssembly Code Mode transport for Mastra, backed by QuickJS — no native binaries and no Node flags required. Use `@mastra/quickjs` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/quickjs
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import * as packageApi from '@mastra/quickjs';

const availableExports = Object.keys(packageApi);
```

## Documentation

- [@mastra/quickjs documentation](https://mastra.ai/reference/coding-agent/create-coding-agent)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/code-mode/quickjs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
