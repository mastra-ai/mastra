# @mastra/valkey-streams

Mastra Valkey Streams PubSub integration. Use `@mastra/valkey-streams` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/valkey-streams
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { ValkeyStreamsPubSub } from '@mastra/valkey-streams';

const pubsub = new ValkeyStreamsPubSub({
  url: process.env.VALKEY_URL!,
  keyPrefix: 'mastra:my-app',
});
```

## Documentation

- [@mastra/valkey-streams documentation](https://mastra.ai/reference/pubsub/valkey-streams)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/pubsub/valkey-streams/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
