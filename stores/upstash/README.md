# @mastra/upstash

Use Upstash Redis as serverless Mastra storage with REST credentials, namespaced keys, durable persistence, and deployment-friendly connections.

## Installation

```bash
npm install @mastra/upstash
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { UpstashStore } from '@mastra/upstash';

const store = new UpstashStore({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
```

## Documentation

- [Upstash](https://mastra.ai/integrations/databases/upstash)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/upstash/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
