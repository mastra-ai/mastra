# @mastra/mssql

Microsoft SQL Server implementation for Mastra, providing general storage capabilities with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/mssql
```

## Prerequisites

- Microsoft SQL Server 2016 or higher
- User with privileges to create tables and schemas (if needed)

## Usage

### Storage

#### Basic Configuration

MSSQLStore supports multiple connection methods:

**1. Connection String (Recommended)**

```typescript
import { MSSQLStore } from '@mastra/mssql';

const store = new MSSQLStore({
  connectionString:
    'Server=localhost,1433;Database=mastra;User Id=sa;Password=yourPassword;Encrypt=true;TrustServerCertificate=true',
});
```

**2. Server/Port/Database Configuration**

```typescript
const store = new MSSQLStore({
  server: 'localhost',
  port: 1433,
  database: 'mastra',
  user: 'sa',
  password: 'yourStrong(!)Password',
  options: { encrypt: true, trustServerCertificate: true }, // Optional
});
```

#### Advanced Options

```typescript
const store = new MSSQLStore({
  connectionString:
    'Server=localhost,1433;Database=mastra;User Id=sa;Password=yourPassword;Encrypt=true;TrustServerCertificate=true',
  schemaName: 'custom_schema', // Use custom schema (default: dbo)
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
    pool: {
      max: 20,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },
});
```

#### Usage Example

```typescript
// Create a thread
await store.saveThread({
  thread: {
    id: 'thread-123',
    resourceId: 'resource-456',
    title: 'My Thread',
    metadata: { key: 'value' },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

// Add messages to thread
await store.saveMessages({
  messages: [
    {
      id: 'msg-789',
      threadId: 'thread-123',
      role: 'user',
      type: 'text',
      content: [{ type: 'text', text: 'Hello' }],
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

MSSQLStore supports multiple connection methods:

1. **Connection String**

   ```typescript
   {
     connectionString: 'Server=localhost,1433;Database=mastra;User Id=sa;Password=yourPassword;Encrypt=true;TrustServerCertificate=true';
   }
   ```

2. **Server/Port/Database**
   ```typescript
   {
     server: 'localhost',
     port: 1433,
     database: 'mastra',
     user: 'sa',
     password: 'password'
   }
   ```

### Optional Configuration

- `schemaName`: Custom SQL Server schema (default: `dbo`)
- `options.encrypt`: Enable encryption (default: `true`)
- `options.trustServerCertificate`: Trust self-signed certificates (default: `true`)
- `options.connectTimeout`: Connection timeout in milliseconds (default: `15000`)
- `options.requestTimeout`: Request timeout in milliseconds (default: `15000`)
- `options.pool.max`: Maximum pool connections (default: `10`)
- `options.pool.min`: Minimum pool connections (default: `0`)
- `options.pool.idleTimeoutMillis`: Idle connection timeout (default: `30000`)

### Default Connection Pool Settings

- Maximum connections: 10
- Minimum connections: 0
- Idle timeout: 30 seconds
- Connection timeout: 15 seconds
- Request timeout: 15 seconds

## Features

### Storage Features

- **Thread and Message Management**
  - Thread and message storage with JSON support
  - Message format versioning (v1 and v2)
  - Pagination support for threads and messages
  - Atomic transactions for batch operations (save, update, delete)
  - Automatic thread timestamp updates
  - Cascading deletes
- **Resources**
  - Resource storage with working memory
  - Rich metadata support
  - Update working memory and metadata independently

- **Tracing & Observability**
  - Trace AI agent execution with spans
  - Query traces with pagination and filtering
  - Batch operations for high-volume tracing
  - Parent-child span relationships
  - Span metadata and timing information

- **Workflow Management**
  - Persist and restore workflow execution state
  - Track workflow run history
  - Step-by-step result tracking with row-level locking
  - Workflow status management with row-level locking
  - Query workflow runs by date range or resource
  - Concurrent update protection for parallel workflow execution

- **Scoring & Evaluation**
  - Store evaluation scores and metrics
  - Query scores by scorer, run, entity, or span
  - Support for multiple scoring sources
  - Pagination support for large score datasets

- **Performance & Scalability**
  - Connection pooling with configurable limits
  - Atomic transactions for all batch operations
  - Efficient batch insert/update/delete with transaction safety
  - Row-level locking for concurrent updates
  - Automatic performance indexes
  - Index management (create, list, describe, drop)
  - Timestamp tracking with high precision
- **Data Management**
  - Custom schema support
  - Table operations (create, alter, clear, drop)
  - Low-level insert and load operations
  - JSON data type support

## Storage Methods

### Initialization & Connection

- `init()`: Initialize the store and create tables
- `close()`: Close database connection pool

### Threads

- `saveThread({ thread })`: Create or update a thread
- `getThreadById({ threadId })`: Get a thread by ID
- `updateThread({ id, title, metadata })`: Update thread title and metadata
- `deleteThread({ threadId })`: Delete a thread and its messages
- `listThreadsByResourceId({ resourceId, offset, limit, orderBy? })`: List paginated threads for a resource

### Messages

- `saveMessages({ messages })`: Save multiple messages with atomic transaction
- `listMessagesById({ messageIds })`: Get messages by their IDs
- `listMessages({ threadId, resourceId?, page?, perPage?, orderBy?, filter? })`: Get paginated messages for a thread with filtering and sorting
- `updateMessages({ messages })`: Update existing messages with atomic transaction
- `deleteMessages(messageIds)`: Delete specific messages with atomic transaction

### Resources

- `saveResource({ resource })`: Save a resource with working memory
- `getResourceById({ resourceId })`: Get a resource by ID
- `updateResource({ resourceId, workingMemory?, metadata? })`: Update resource working memory and metadata

### Tracing & Observability

- `createSpan(span)`: Create a trace span
- `updateSpan({ spanId, traceId, updates })`: Update an existing span
- `getTrace(traceId)`: Get complete trace with all spans
- `getTracesPaginated({ filters?, pagination? })`: Query traces with pagination and filters
- `batchCreateSpans({ records })`: Batch create multiple spans
- `batchUpdateSpans({ records })`: Batch update multiple spans
- `batchDeleteTraces({ traceIds })`: Batch delete traces

### Index Management

- `createIndex({ name, table, columns, unique?, where? })`: Create a new index
- `listIndexes(tableName?)`: List all indexes or indexes for a specific table
- `describeIndex(indexName)`: Get detailed index statistics and information
- `dropIndex(indexName)`: Drop an existing index

### Workflows

- `persistWorkflowSnapshot({ workflowName, runId, resourceId?, snapshot })`: Save workflow execution state
- `loadWorkflowSnapshot({ workflowName, runId })`: Load workflow execution state
- `updateWorkflowResults({ workflowName, runId, stepId, result, runtimeContext })`: Update step results (transaction + row locking)
- `updateWorkflowState({ workflowName, runId, opts })`: Update workflow run status (transaction + row locking)
- `listWorkflowRuns({ workflowName?, fromDate?, toDate?, limit?, offset?, resourceId? })`: Query workflow runs
- `getWorkflowRunById({ runId, workflowName? })`: Get specific workflow run

### Scores & Evaluation

- `saveScore(score)`: Save evaluation score
- `getScoreById({ id })`: Get score by ID
- `listScoresByScorerId({ scorerId, pagination, entityId?, entityType?, source? })`: Get scores by scorer
- `listScoresByRunId({ runId, pagination })`: Get scores for a run
- `listScoresByEntityId({ entityId, entityType, pagination })`: Get scores for an entity
- `listScoresBySpan({ traceId, spanId, pagination })`: Get scores for a trace span

### Traces (Legacy)

- `getTracesPaginated({ filters?, pagination? })`: Get paginated legacy traces
- `batchTraceInsert({ records })`: Batch insert legacy trace records

### Evals (Legacy)

- `getEvals({ agentName?, type?, page?, perPage? })`: Get paginated evaluations

### Low-level Operations

- `createTable({ tableName, schema })`: Create a new table
- `alterTable({ tableName, schema, ifNotExists })`: Add columns to existing table
- `clearTable({ tableName })`: Remove all rows from a table
- `dropTable({ tableName })`: Drop a table
- `insert({ tableName, record })`: Insert a single record
- `batchInsert({ tableName, records })`: Batch insert multiple records
- `load<R>({ tableName, keys })`: Load a record by key(s)

## Index Management

The MSSQL store provides comprehensive index management capabilities to optimize query performance.

### Automatic Performance Indexes

MSSQL storage automatically creates composite indexes during initialization for common query patterns. These indexes significantly improve performance for filtered queries with sorting.

### Creating Custom Indexes

```typescript
// Basic index for common queries
await store.createIndex({
  name: 'idx_threads_resource',
  table: 'mastra_threads',
  columns: ['resourceId'],
});

// Composite index with sort order for filtering + sorting
await store.createIndex({
  name: 'idx_messages_composite',
  table: 'mastra_messages',
  columns: ['thread_id', 'seq_id DESC'],
});

// Unique index for constraints
await store.createIndex({
  name: 'idx_unique_constraint',
  table: 'mastra_resources',
  columns: ['id'],
  unique: true,
});

// Filtered index (partial indexing)
await store.createIndex({
  name: 'idx_active_threads',
  table: 'mastra_threads',
  columns: ['resourceId'],
  where: "status = 'active'",
});
```

### Managing Indexes

```typescript
// List all indexes
const allIndexes = await store.listIndexes();

// List indexes for specific table
const threadIndexes = await store.listIndexes('mastra_threads');

// Get detailed statistics for an index
const stats = await store.describeIndex('idx_threads_resource');
console.log(stats);
// {
//   name: 'idx_threads_resource',
//   table: 'mastra_threads',
//   columns: ['resourceId', 'seq_id'],
//   unique: false,
//   size: '128 KB',
//   method: 'nonclustered',
//   scans: 1542,           // Number of index seeks
//   tuples_read: 45230,    // Tuples read via index
//   tuples_fetched: 12050  // Tuples fetched via index
// }

// Drop an index
await store.dropIndex('idx_threads_resource');
```

### Monitoring Index Performance

```typescript
// Check index usage statistics
const stats = await store.describeIndex('idx_threads_resource');

// Identify unused indexes
if (stats.scans === 0) {
  console.log(`Index ${stats.name} is unused - consider removing`);
  await store.dropIndex(stats.name);
}

// Monitor index efficiency
const efficiency = stats.tuples_fetched / stats.tuples_read;
if (efficiency < 0.5) {
  console.log(`Index ${stats.name} has low efficiency: ${efficiency}`);
}
```

## Related Links

- [Microsoft SQL Server Documentation](https://docs.microsoft.com/en-us/sql/sql-server/)
- [node-mssql Documentation](https://www.npmjs.com/package/mssql)
