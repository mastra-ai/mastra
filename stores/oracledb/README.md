# @mastra/oracledb

Oracle Database provider for Mastra, providing storage and vector similarity search with Oracle JSON, Oracle `VECTOR`, connection pooling, and transaction support.

## Installation

```bash
npm install @mastra/oracledb
```

## Usage

### Storage

```typescript
import { OracleStore } from '@mastra/oracledb';

const store = new OracleStore({
  id: 'oracle-store',
  user: process.env.ORACLE_DATABASE_USER,
  password: process.env.ORACLE_DATABASE_PASSWORD,
  connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
});

await store.init();
const memory = await store.getStore('memory');
if (!memory) throw new Error('Oracle memory store is not available');

// Create a thread
await memory.saveThread({
  thread: {
    id: 'thread-123',
    resourceId: 'resource-456',
    title: 'My Thread',
    metadata: { key: 'value' },
    createdAt: new Date(),
  },
});

// Add messages to thread
await memory.saveMessages({
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
const savedThread = await memory.getThreadById({ threadId: 'thread-123' });
const { messages } = await memory.listMessages({ threadId: 'thread-123' });
```

## Documentation

- [Oracle Database integration guide](https://mastra.ai/integrations/databases/oracledb)
- [Oracle Database vector reference](https://mastra.ai/reference/vectors/oracledb)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/oracledb/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
