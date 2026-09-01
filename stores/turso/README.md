# @mastra/turso

Use the Turso storage adapter to persist Mastra agents, workflows, memory, and other storage domains in a local database file.

## Installation

```bash
npm install @mastra/turso
```

## Usage

```typescript
import { TursoStore } from '@mastra/turso';

const storage = new TursoStore({
  id: 'local-storage',
  path: './mastra.db',
});

await storage.init();
```

## Documentation

- [Turso Storage](https://mastra.ai/reference/storage/turso)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/turso/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
