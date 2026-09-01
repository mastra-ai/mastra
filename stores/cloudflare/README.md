# @mastra/cloudflare

Cloudflare provider for Mastra - includes db storage capabilities. Use `@mastra/cloudflare` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/cloudflare
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { CloudflareStore } from '@mastra/cloudflare';

const store = new CloudflareStore({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  namespacePrefix: 'mastra',
});
```

## Documentation

- [@mastra/cloudflare documentation](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/cloudflare/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
