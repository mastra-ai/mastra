# @mastra/clickhouse

Clickhouse implementation for Mastra, providing efficient storage capabilities with support for threads, messages, and workflow snapshots.

## Installation

```bash
npm install @mastra/clickhouse
```

## Usage

```typescript
import { ClickhouseStore } from '@mastra/clickhouse';

const store = new ClickhouseStore({
  url: 'http://localhost:8123',
  username: 'default',
  password: 'password',
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
const { messages } = await store.listMessages({ threadId: 'thread-123' });

// Clean up
await store.close();
```

## Documentation

- [ClickHouse integration guide](https://mastra.ai/integrations/databases/clickhouse)
- [Storage reference](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/clickhouse/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
