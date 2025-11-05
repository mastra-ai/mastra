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

- `saveThread({ thread })`: Create or update a thread
- `getThreadById({ threadId })`: Get a thread by ID
- `listThreadsByResourceId({ resourceId, offset, limit, orderBy? })`: List paginated threads for a resource
- `updateThread({ id, title, metadata })`: Update thread title and metadata
- `deleteThread({ threadId })`: Delete a thread and its messages

### Message Operations

- `saveMessages({ messages })`: Save multiple messages
- `listMessages({ threadId, perPage?, page? })`: Get messages for a thread with pagination
- `updateMessages({ messages })`: Update existing messages

### Resource Operations

- `getResourceById({ resourceId })`: Get a resource by ID
- `saveResource({ resource })`: Create or save a resource
- `updateResource({ resourceId, workingMemory })`: Update resource working memory

### Workflow Operations

- `persistWorkflowSnapshot({ workflowName, runId, snapshot })`: Save workflow state
- `loadWorkflowSnapshot({ workflowName, runId })`: Load workflow state
- `listWorkflowRuns({ workflowName, pagination })`: List workflow runs with pagination
- `getWorkflowRunById({ workflowName, runId })`: Get a specific workflow run

### Evaluation/Scoring Operations

- `getScoreById({ id })`: Get a score by ID
- `saveScore(score)`: Save an evaluation score
- `listScoresByScorerId({ scorerId, pagination })`: List scores by scorer with pagination
- `listScoresByRunId({ runId, pagination })`: List scores by run with pagination
- `listScoresByEntityId({ entityId, entityType, pagination })`: List scores by entity with pagination
- `listScoresBySpan({ traceId, spanId, pagination })`: List scores by span with pagination

### Operations Not Currently Supported

- `deleteMessages(messageIds)`: Message deletion is not supported in ClickHouse
- AI Observability (traces/spans): Not currently supported

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
