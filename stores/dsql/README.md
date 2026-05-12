# @mastra/dsql

Amazon Aurora DSQL storage implementation for Mastra, providing thread, message, workflow, and observability storage using Aurora DSQL with IAM authentication.

> **Note**  
> Aurora DSQL doesn’t support PostgreSQL extensions (`CREATE EXTENSION`), including `pgvector`.  
> For vector storage, use a separate vector store like `@mastra/s3vectors`.

## Installation

```bash
npm install @mastra/dsql
```

## Prerequisites

- Amazon Aurora DSQL cluster
- AWS credentials with access to the DSQL cluster (IAM authentication)

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

## Configuration

### Connection Methods

`DSQLStore` supports multiple connection methods:

**1. Host Configuration (Recommended)**

```typescript
import { DSQLStore } from '@mastra/dsql';

const store = new DSQLStore({
  id: 'my-dsql-store',
  host: 'abc123.dsql.us-east-1.on.aws',
  // region is auto-detected from host, or specify explicitly
  // user: 'admin', // default
  // database: 'postgres', // default
  schemaName: 'custom_schema', // optional
});
```

**2. Pre-configured pg.Pool**

```typescript
import { Pool } from 'pg';
import { AuroraDSQLClient } from '@aws/aurora-dsql-node-postgres-connector';
import { DSQLStore } from '@mastra/dsql';

const pool = new Pool({
  host: 'abc123.dsql.us-east-1.on.aws',
  Client: AuroraDSQLClient,
  region: 'us-east-1',
});

const store = new DSQLStore({
  id: 'my-dsql-store',
  pool,
});

// Use store.pool for other libraries that need a pg.Pool
```

### Custom AWS Credentials

```typescript
import { DSQLStore } from '@mastra/dsql';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const store = new DSQLStore({
  id: 'my-dsql-store',
  host: 'abc123.dsql.us-east-1.on.aws',
  customCredentialsProvider: fromNodeProviderChain(),
});
```

### Connection Pool Settings

```typescript
const store = new DSQLStore({
  id: 'my-dsql-store',
  host: 'abc123.dsql.us-east-1.on.aws',

  // Connection pool settings
  max: 10, // maximum connections (default: 10)
  min: 0, // minimum connections (default: 0)
  idleTimeoutMillis: 600000, // 10 minutes (default)
  maxLifetimeSeconds: 3300, // 55 minutes (default, must be < 3600)
  connectionTimeoutMillis: 5000, // 5 seconds (default)
  allowExitOnIdle: true, // default: true
});
```

### Configuration Options

| Option                      | Type                          | Default         | Description                                                                                               |
| --------------------------- | ----------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `id`                        | string                        | (required)      | Unique identifier for this store instance                                                                 |
| `host`                      | string                        | (required)\*    | DSQL cluster endpoint (e.g., `abc123.dsql.us-east-1.on.aws`)                                              |
| `pool`                      | pg.Pool                       | -               | Pre-configured pg.Pool instance (cannot be used with host)                                                |
| `user`                      | string                        | `'admin'`       | Database user (Aurora DSQL built-in admin role is `admin`)                                                |
| `database`                  | string                        | `'postgres'`    | Database name (Aurora DSQL exposes a single built-in database named `postgres` per cluster)               |
| `region`                    | string                        | (auto-detected) | AWS region, extracted from host if not provided                                                           |
| `schemaName`                | string                        | `'public'`      | PostgreSQL schema name where Mastra tables/indexes are created                                            |
| `customCredentialsProvider` | AwsCredentialIdentityProvider | (default chain) | Custom AWS credentials provider                                                                           |
| `max`                       | number                        | `10`            | Maximum connections in the pool                                                                           |
| `min`                       | number                        | `0`             | Minimum connections in the pool                                                                           |
| `idleTimeoutMillis`         | number                        | `600000`        | Close idle connections after this many milliseconds                                                       |
| `maxLifetimeSeconds`        | number                        | `3300`          | Maximum connection lifetime in seconds (must be `< 3600` due to Aurora DSQL’s 60-minute connection limit) |
| `connectionTimeoutMillis`   | number                        | `5000`          | Connection acquisition timeout in milliseconds                                                            |
| `allowExitOnIdle`           | boolean                       | `true`          | Allow the process to exit when all connections are idle                                                   |

\* Either `host` or `pool` is required.

### Default Connection Pool Settings

The default pool settings are optimized for Aurora DSQL:

- Maximum connections: 10
- Idle timeout: 10 minutes (600,000 ms)
- Max connection lifetime: 55 minutes (3,300 seconds)
- Connection timeout: 5 seconds

The `maxLifetimeSeconds` is set to 55 minutes to ensure connections are rotated before Aurora DSQL's 60-minute connection duration limit.

## Aurora DSQL Specifics

`@mastra/dsql` is built on top of [Amazon Aurora DSQL](https://docs.aws.amazon.com/aurora-dsql/) using the official Node.js connector.
You usually interact with it like any other Mastra store, but there are some important Aurora DSQL characteristics to be aware of:

- **IAM-only authentication**
  - Connections are authenticated with IAM (no database passwords).
  - `@mastra/dsql` uses `@aws/aurora-dsql-node-postgres-connector` to generate short-lived auth tokens automatically.
  - You can plug in a custom credentials provider via `customCredentialsProvider`.

- **Single database, schema-based isolation**
  - Each cluster exposes a single built-in database named `postgres` (no `CREATE DATABASE`).
  - Logical separation is done via schemas; `schemaName` controls where Mastra tables are created.
  - Typical pattern: initialize as `admin`, optionally create an application schema, then connect as a non-admin role using that schema.

- **No PostgreSQL extensions**
  - `CREATE EXTENSION` is not supported (including `pgvector`, `PostGIS`, etc.).
  - For vectors or extension-based features, use a separate store (e.g. `@mastra/s3vectors`) alongside `DSQLStore`.

- **JSON stored as text**
  - JSON/JSONB are available as _query_ types but not as column types.
  - `@mastra/dsql` stores structured fields (metadata, content, etc.) in `TEXT` columns and casts to JSON at query time as needed.

- **Schema & DDL constraints**
  - Some PostgreSQL features are not available (e.g. foreign key constraints, `TRUNCATE`, synchronous `CREATE INDEX`).
  - Indexes are created asynchronously using `CREATE INDEX ASYNC`; there is a limit on the number of indexes per table.
  - The store’s `init()` and index helper APIs are implemented to respect these constraints.

- **Transactions & optimistic concurrency**
  - Aurora DSQL uses optimistic concurrency control (OCC) and may return retriable OCC errors under contention.
  - There are limits on transaction duration and size; large bulk operations should be split into smaller batches at the application level.

- **Connection lifetime**
  - Individual connections are limited to about 60 minutes.
  - The default `maxLifetimeSeconds: 3300` ensures connections are recycled before hitting this limit.

## Features

### Storage Features

- Thread and message storage with JSON support
- Atomic transactions for data consistency
- Efficient batch operations
- Rich metadata support
- Timestamp tracking

## Storage Methods

### Thread Operations

- `saveThread({ thread })`: Create or update a thread
- `getThreadById({ threadId })`: Get a thread by ID
- `updateThread({ id, title, metadata })`: Update thread title and/or metadata
- `deleteThread({ threadId })`: Delete a thread and its messages
- `listThreadsByResourceId({ resourceId, offset, limit, orderBy? })`: List paginated threads for a resource

### Message Operations

- `saveMessages({ messages })`: Save multiple messages in a transaction
- `listMessages({ threadId, resourceId?, perPage?, page?, orderBy?, filter? })`: Get messages for a thread with pagination
- `listMessagesById({ messageIds })`: Get specific messages by their IDs
- `updateMessages({ messages })`: Update existing messages
- `deleteMessages(messageIds)`: Delete specific messages

### Resource Operations

- `getResourceById({ resourceId })`: Get a resource by ID
- `saveResource({ resource })`: Create or save a resource
- `updateResource({ resourceId, workingMemory?, metadata? })`: Update resource working memory and/or metadata

### Workflow Operations

- `persistWorkflowSnapshot({ workflowName, runId, snapshot })`: Save workflow state
- `loadWorkflowSnapshot({ workflowName, runId })`: Load workflow state
- `listWorkflowRuns({ workflowName, pagination })`: List workflow runs with pagination
- `getWorkflowRunById({ workflowName, runId })`: Get a specific workflow run
- `updateWorkflowState({ workflowName, runId, state })`: Update workflow state
- `updateWorkflowResults({ workflowName, runId, results })`: Update workflow results

### Observability Operations

- `createSpan(span)`: Create a single span
- `batchCreateSpans({ records })`: Create multiple spans
- `updateSpan({ traceId, spanId, updates })`: Update a span
- `batchUpdateSpans({ records })`: Update multiple spans
- `getTrace(traceId)`: Get a trace by ID
- `getTracesPaginated({ ...filters, pagination })`: Get paginated traces with filtering
- `batchDeleteTraces({ traceIds })`: Delete multiple traces

### Evaluation/Scoring Operations

- `getScoreById({ id })`: Get a score by ID
- `saveScore(score)`: Save an evaluation score
- `listScoresByScorerId({ scorerId, pagination })`: List scores by scorer with pagination
- `listScoresByRunId({ runId, pagination })`: List scores by run with pagination
- `listScoresByEntityId({ entityId, entityType, pagination })`: List scores by entity with pagination
- `listScoresBySpan({ traceId, spanId, pagination })`: List scores by span with pagination

## Index Management

The store creates performance indexes during initialization for common query patterns:

- `mastra_threads_resourceid_createdat_idx`: (resourceId, createdAt)
- `mastra_messages_thread_id_createdat_idx`: (thread_id, createdAt)
- `mastra_ai_spans_traceid_startedat_idx`: (traceId, startedAt)
- `mastra_ai_spans_parentspanid_startedat_idx`: (parentSpanId, startedAt)
- `mastra_ai_spans_name_idx`: (name)
- `mastra_ai_spans_spantype_startedat_idx`: (spanType, startedAt)
- `mastra_scores_trace_id_span_id_created_at_idx`: (traceId, spanId, createdAt)

Notes:

- Aurora DSQL creates these indexes asynchronously using `CREATE INDEX ASYNC`.
- Because index creation is asynchronous, new indexes may not be immediately available after `init()`. The store will continue to function without them, but queries may be slower until index creation completes.

### Custom Indexes

Create additional indexes to optimize specific query patterns:

```typescript
await store.createIndex({
  name: 'idx_threads_resource',
  table: 'mastra_threads',
  columns: ['resourceId'],
});

await store.createIndex({
  name: 'idx_messages_composite',
  table: 'mastra_messages',
  columns: ['thread_id', 'createdAt'],
});
```

Under the hood:

- `createIndex` uses `CREATE INDEX ASYNC`.
- Aurora DSQL doesn’t allow `ASC`/`DESC` in `CREATE INDEX ASYNC`, so `columns` should be plain column names.

### Managing Indexes

```typescript
// List all indexes
const allIndexes = await store.listIndexes();

// List indexes for a specific table
const threadIndexes = await store.listIndexes('mastra_threads');

// Get detailed statistics for an index
const stats = await store.describeIndex('idx_threads_resource');
console.log(stats);
// {
//   name: 'idx_threads_resource',
//   table: 'mastra_threads',
//   columns: ['resourceId'],
//   unique: false,
//   size: '128 KB',
//   definition: 'CREATE INDEX idx_threads_resource...',
//   method: 'btree',
//   scans: 1542,
//   tuples_read: 45230,
//   tuples_fetched: 12050
// }

// Drop an index
await store.dropIndex('idx_threads_status');
```

### Index Options

- `name` (required): Index name
- `table` (required): Table name
- `columns` (required): Array of column names (ASC/DESC automatically stripped for Aurora DSQL)
- `unique`: Create unique index (default: false)
- `concurrent`: Ignored in Aurora DSQL (indexes are always async)
- `where`: Partial index condition
- `method`: Ignored in Aurora DSQL (only btree supported)

## Related Links

- [Aurora DSQL Documentation](https://docs.aws.amazon.com/aurora-dsql/)
- [SQL Reference](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-aurora-dsql-sql.html)
- [Supported SQL Features](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-supported-sql-features.html)
- [Unsupported PostgreSQL Features](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html)
- [Supported Data Types](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-supported-data-types.html)
- [Asynchronous Indexes](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-create-index-async.html)
