# @mastra/redis-streams

`RedisStreamsPubSub` implements Mastra's PubSub and lease-provider contracts with Redis Streams. Use it for durable event delivery, consumer-group coordination, and workflow leases across multiple processes or hosts.

## Installation

```bash
npm install @mastra/redis-streams
```

## Usage

Requires Redis 7.0 or later.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { RedisStreamsPubSub } from '@mastra/redis-streams';

export const mastra = new Mastra({
  pubsub: new RedisStreamsPubSub({
    url: process.env.REDIS_URL!,
    keyPrefix: 'mastra:my-app',
  }),
});
```

### Redis Cluster

Pass `cluster` (forwarded to `createCluster()` from `redis`) instead of `url`/`redisOptions`:

```typescript
import { RedisStreamsPubSub } from '@mastra/redis-streams';

const pubsub = new RedisStreamsPubSub({
  cluster: { rootNodes: [{ url: 'redis://node-1:6379' }, { url: 'redis://node-2:6379' }] },
});
```

To build the client yourself (TLS, Sentinel, credential providers), pass an unconnected `client` instead; readers are created from it with `client.duplicate()` and the pubsub owns its lifecycle.

## Documentation

- [Reference: RedisStreamsPubSub](https://mastra.ai/reference/pubsub/redis-streams)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/pubsub/redis-streams/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
