# @mastra/valkey-streams

`ValkeyStreamsPubSub` implements Mastra's PubSub and lease-provider contracts with Valkey Streams through Valkey GLIDE. Use it for durable event delivery and distributed workflow coordination when your infrastructure is built on Valkey.

## Installation

```bash
npm install @mastra/valkey-streams
```

## Usage

```typescript
import { Mastra } from '@mastra/core/mastra';
import { ValkeyStreamsPubSub } from '@mastra/valkey-streams';

export const mastra = new Mastra({
  pubsub: new ValkeyStreamsPubSub({
    url: process.env.VALKEY_URL!,
    keyPrefix: 'mastra:my-app',
  }),
});
```

## Documentation

- [Reference: ValkeyStreamsPubSub](https://mastra.ai/reference/pubsub/valkey-streams)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/pubsub/valkey-streams/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
