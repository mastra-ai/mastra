# @mastra/dsql

Amazon Aurora DSQL storage implementation for Mastra, providing thread, message, workflow, and observability storage using Aurora DSQL with IAM authentication.

> **Note:** Aurora DSQL doesn’t support PostgreSQL extensions (`CREATE EXTENSION`), including `pgvector`. For vector storage, use a separate vector store like `@mastra/s3vectors`.

## Installation

```bash
npm install @mastra/dsql
```

## Usage

### Storage

```typescript
import { DSQLStore } from '@mastra/dsql';

const store = new DSQLStore({
  id: 'my-dsql-store',
  host: 'abc123.dsql.us-east-1.on.aws',
  // region is auto-detected from host, or specify explicitly:
  // region: 'us-east-1',
  // user: 'admin', // default
  // database: 'postgres', // default
});

// Initialize the store (creates tables if needed)
await store.init();

// Create a thread
await store.saveThread({
  thread: {
    id: 'thread-123',
    resourceId: 'resource-456',
    title: 'My Thread',
    metadata: { key: 'value' },
    createdAt: new Date(),
  },
});

// Add messages to thread
await store.saveMessages({
  messages: [
    {
      id: 'msg-789',
      threadId: 'thread-123',
      role: 'user',
      content: { content: 'Hello' },
      resourceId: 'resource-456',
      createdAt: new Date(),
    },
  ],
});

// Query threads and messages
const savedThread = await store.getThreadById({ threadId: 'thread-123' });
const messages = await store.listMessages({ threadId: 'thread-123' });
```

## Documentation

- [Amazon Aurora DSQL integration guide](https://mastra.ai/integrations/databases/aurora-dsql)
- [Storage reference](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/dsql/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
