# @mastra/redis-streams

`RedisStreamsPubSub` implements Mastra's PubSub and lease-provider contracts with Redis Streams. Use it for durable event delivery, consumer-group coordination, and workflow leases across multiple processes or hosts.

## Installation

```bash
npm install @mastra/redis-streams
```

## Usage

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

## Documentation

- [Reference: RedisStreamsPubSub](https://mastra.ai/reference/pubsub/redis-streams)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/pubsub/redis-streams/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
