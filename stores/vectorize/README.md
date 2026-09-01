# @mastra/vectorize

Cloudflare Vectorize store provider for Mastra. Use `@mastra/vectorize` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/vectorize
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { CloudflareVector } from '@mastra/vectorize';

const vectorStore = new CloudflareVector({
  id: 'cloudflare-vector',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
});
```

## Documentation

- [@mastra/vectorize documentation](https://mastra.ai/reference/vectors/vectorize)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/vectorize/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
