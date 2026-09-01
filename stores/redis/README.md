# @mastra/redis

Store Mastra application data in Redis using connection strings, host settings, or custom clients, including Sentinel and Cluster deployments.

## Installation

```bash
npm install @mastra/redis
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { RedisStore } from '@mastra/redis';
import { createCluster } from 'redis';

const cluster = createCluster({
  rootNodes: [{ url: 'redis://node-1:6379' }, { url: 'redis://node-2:6379' }],
});
await cluster.connect();

const storage = new RedisStore({
  id: 'cluster',
  client: cluster,
});
```

## Documentation

- [Redis](https://mastra.ai/integrations/databases/redis)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/redis/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
