# @mastra/valkey

Valkey storage and cache provider for Mastra, powered by Valkey GLIDE. Use `@mastra/valkey` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/valkey
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { ValkeyStore } from '@mastra/valkey';
import { createCluster } from 'valkey';

const cluster = createCluster({
  rootNodes: [{ url: 'valkey://node-1:6379' }, { url: 'valkey://node-2:6379' }],
});
await cluster.connect();

const storage = new ValkeyStore({
  id: 'cluster',
  client: cluster,
});
```

## Documentation

- [@mastra/valkey documentation](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/valkey/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
