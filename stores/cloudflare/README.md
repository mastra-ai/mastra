# @mastra/cloudflare

Cloudflare KV store for Mastra, providing scalable and serverless storage for threads, messages, workflow snapshots, and evaluations. Supports both Cloudflare Workers KV Bindings and the REST API for flexible deployment in serverless and Node.js environments.

## Installation

```bash
npm install @mastra/cloudflare
```

## Usage

```typescript
import { CloudflareStore } from '@mastra/cloudflare';

const store = new CloudflareStore({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  namespacePrefix: 'myapp_',
});

// Save a thread
await store.saveThread({
  thread: {
    id: 'thread-123',
    resourceId: 'resource-456',
    title: 'My Thread',
    metadata: { key: 'value' },
    createdAt: new Date(),
  },
});

// Add messages
await store.saveMessages({
  messages: [
    {
      id: 'msg-1',
      threadId: 'thread-123',
      content: 'Hello Cloudflare!',
      role: 'user',
      createdAt: new Date(),
    },
  ],
});

// Query messages
const messages = await store.listMessages({ threadId: 'thread-123' });
```

## Documentation

- [Cloudflare KV integration guide](https://mastra.ai/integrations/databases/cloudflare-kv)
- [Storage reference](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/cloudflare/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
