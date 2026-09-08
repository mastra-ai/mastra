# @mastra/valkey

Valkey storage provider for Mastra that provides storage capabilities for direct Valkey connections.

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

- [Valkey integration guide](https://mastra.ai/integrations/databases/valkey)
- [Storage reference](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/valkey/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
