# @mastra/clickhouse

Clickhouse implementation for Mastra, providing efficient storage capabilities with support for threads, messages, and workflow snapshots.

## Installation

```bash
npm install @mastra/clickhouse
```

## Prerequisites

- Clickhouse server (version 23.3 or higher required for delete operations; earlier versions may work for read/write operations)
  - Lightweight `DELETE FROM` requires ClickHouse 22.8+ with `allow_experimental_lightweight_delete = 1` (for 22.8–23.2), or 23.3+ where it is generally available.
  - The `deleteTask`, `deleteTasks`, and `deleteMessages` methods use `DELETE FROM` — ensure your server supports lightweight delete before using those operations.
- Node.js 22.13.0 or later

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
  replication?: {
    cluster?: string; // Adds ON CLUSTER to Mastra-owned DDL when set
    zookeeperPath?: string; // Defaults to '/clickhouse/tables/{shard}/{database}/{table}'
    replicaName?: string; // Defaults to '{replica}'
  };
};
```

### Replicated ClickHouse clusters

Set `replication` when Mastra writes to a multi-replica ClickHouse cluster through a load balancer. Mastra will create its tables with replicated MergeTree engines and add `ON CLUSTER` to Mastra-owned DDL when `cluster` is provided.

```typescript
const store = new ClickhouseStore({
  url: 'http://clickhouse-lb:8123',
  username: 'default',
  password: 'password',
  replication: {
    cluster: 'company_cluster',
  },
});
```

The default `zookeeperPath` is `/clickhouse/tables/{shard}/{database}/{table}`. If your cluster's existing tables use a different layout (for example `/clickhouse/tables/{shard}/{table}` without the `{database}` segment), set `zookeeperPath` explicitly to match. Mastra does not infer your cluster's convention from Keeper.

Manual maintenance such as `optimizeTable()` and `materializeTtl()` runs on every replica when `cluster` is set. These operations can be expensive on a large cluster. Prefer running them outside peak hours.

If Mastra finds an existing local `MergeTree` or `ReplacingMergeTree` table while replication is enabled, initialization fails instead of silently mixing local and replicated tables. Migrate existing local tables manually before enabling this option.

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
- `ReplicatedMergeTree(...)` / `ReplicatedReplacingMergeTree(...)`: Used instead when `replication` is enabled

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

- AI Observability (traces/spans): Not currently supported

## Data Types

The store supports the following data types:

- `text`: String
- `timestamp`: DateTime64(3)
- `uuid`: String
- `jsonb`: String (JSON serialized)
- `integer`: Int64
- `bigint`: Int64
- `float`: Float64
- `boolean`: Bool

## Related Links

- [Clickhouse Documentation](https://clickhouse.com/docs)
- [Clickhouse Node.js Client](https://github.com/clickhouse/clickhouse-js)
