# @mastra/turso

Turso Database storage provider for Mastra. Use `@mastra/turso` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/turso
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { TursoStore } from '@mastra/turso';

const storage = new TursoStore({
  id: 'local-storage',
  path: './mastra.db',
});

await storage.init();
```

## Documentation

- [@mastra/turso documentation](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/turso/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
