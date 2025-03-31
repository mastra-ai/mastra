# @mastra/clickhouse

Clickhouse implementation for Mastra, providing efficient storage capabilities with support for threads, messages, and workflow snapshots.

## Installation

```bash
npm install @mastra/clickhouse
```

## Prerequisites

- Clickhouse server (version 21.8 or higher recommended)
- Node.js 16 or higher

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
  id: 'thread-123',
  resourceId: 'resource-456',
  title: 'My Thread',
  metadata: { key: 'value' },
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Add messages to thread
await store.saveMessages([
  {
    id: 'msg-789',
    threadId: 'thread-123',
    role: 'user',
    type: 'text',
    content: [{ type: 'text', text: 'Hello' }],
    createdAt: new Date(),
  },
]);

// Query threads and messages
const savedThread = await store.getThreadById({ threadId: 'thread-123' });
const messages = await store.getMessages({ threadId: 'thread-123' });

// Clean up
await store.close();
```

## Configuration

The Clickhouse store can be initialized with the following configuration:

```typescript
type ClickhouseConfig = {
  url: string; // Clickhouse HTTP interface URL
  username: string; // Database username
  password: string; // Database password
};
```

## Features

### Storage Features

- Thread and message storage with JSON support
- Efficient batch operations
- Rich metadata support
- Timestamp tracking
- Workflow snapshot persistence
- Optimized for high-volume data ingestion
- Uses Clickhouse's MergeTree and ReplacingMergeTree engines for optimal performance

### Table Engines

The store uses different table engines for different types of data:

- `MergeTree()`: Used for messages, traces, and evals
- `ReplacingMergeTree()`: Used for threads and workflow snapshots

## Storage Methods

### Thread Operations

- `saveThread(thread)`: Create or update a thread
- `getThreadById({ threadId })`: Get a thread by ID
- `updateThread({ id, title, metadata })`: Update thread title and metadata
- `deleteThread({ threadId })`: Delete a thread and its messages

### Message Operations

- `saveMessages(messages)`: Save multiple messages
- `getMessages({ threadId, selectBy? })`: Get messages for a thread with optional filtering
- `deleteMessages(messageIds)`: Delete specific messages

### Workflow Operations

- `persistWorkflowSnapshot({ workflowName, runId, snapshot })`: Save workflow state
- `loadWorkflowSnapshot({ workflowName, runId })`: Load workflow state

## Data Types

The store supports the following data types:

- `text`: String
- `timestamp`: DateTime64(3)
- `uuid`: String
- `jsonb`: String (JSON serialized)
- `integer`: Int64
- `bigint`: Int64

## Related Links

- [Clickhouse Documentation](https://clickhouse.com/docs)
- [Clickhouse Node.js Client](https://github.com/clickhouse/clickhouse-js)
