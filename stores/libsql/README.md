# @mastra/libsql

Libsql provider for Mastra - includes both vector and db storage capabilities. Use `@mastra/libsql` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/libsql
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { LibSQLStore } from '@mastra/libsql';

const store = new LibSQLStore({
  id: 'libsql-storage',
  url: 'file:./my-db.db',
});

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

- [@mastra/libsql documentation](https://mastra.ai/reference/vectors/libsql)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/libsql/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
