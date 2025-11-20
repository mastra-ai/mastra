# @mastra/pg

PostgreSQL implementation for Mastra, providing both vector similarity search (using pgvector) and general storage capabilities with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/pg
```

## Prerequisites

- PostgreSQL server with pgvector extension installed (if using vector store)
- PostgreSQL 11 or higher

## Usage

### Vector Store

#### Basic Configuration

PgVector supports multiple connection methods:

**1. Connection String (Recommended)**

```typescript
import { PgVector } from '@mastra/pg';

const vectorStore = new PgVector({
  connectionString: 'postgresql://user:pass@localhost:5432/db',
});
```

**2. Host/Port/Database Configuration**

```typescript
const vectorStore = new PgVector({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'postgres',
  password: 'password',
});
```

> **Note:** PgVector also supports advanced configurations like Google Cloud SQL Connector via `pg.ClientConfig`.

#### Advanced Options

```typescript
const vectorStore = new PgVector({
  connectionString: 'postgresql://user:pass@localhost:5432/db',
  schemaName: 'custom_schema', // Use custom schema (default: public)
  max: 30, // Max pool connections (default: 20)
  idleTimeoutMillis: 60000, // Idle timeout (default: 30000)
  pgPoolOptions: {
    // Additional pg pool options
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
  },
});
```

#### Usage Example

```typescript
// Create a new table with vector support
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine',
  // Optional: Configure index type and parameters
  indexConfig: {
    type: 'hnsw',  // 'ivfflat' (default), 'hnsw', or 'flat'
    hnsw: {
      m: 16,              // Number of connections per layer (default: 8)
      efConstruction: 64  // Size of dynamic list (default: 32)
    }
  }
});

// Add vectors
const ids = await vectorStore.upsert({
  indexName: 'my_vectors',
  vectors: [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  metadata: [{ text: 'doc1' }, { text: 'doc2' }],
});

// Query vectors
const results = await vectorStore.query({
  indexName: 'my_vectors',
  queryVector: [0.1, 0.2, ...],
  topK: 10, // topK
  filter: { text: 'doc1' }, // filter
  includeVector: false, // includeVector
  minScore: 0.5, // minScore
});

// Clean up
await vectorStore.disconnect();
```

### Storage

```typescript
import { PostgresStore } from '@mastra/pg';

const store = new PostgresStore({
  host: 'localhost',
  port: 5432,
  database: 'mastra',
  user: 'postgres',
  password: 'postgres',
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

## Configuration

### Connection Methods

Both `PgVector` and `PostgresStore` support multiple connection methods:

1. **Connection String**

   ```typescript
   {
     connectionString: 'postgresql://user:pass@localhost:5432/db';
   }
   ```

2. **Host/Port/Database**
   ```typescript
   {
     host: 'localhost',
     port: 5432,
     database: 'mydb',
     user: 'postgres',
     password: 'password'
   }
   ```

> **Advanced:** Also supports `pg.ClientConfig` for use cases like Google Cloud SQL Connector with IAM authentication.

### Optional Configuration

- `schemaName`: Custom PostgreSQL schema (default: `public`)
- `ssl`: Enable SSL or provide custom SSL options (`true` | `false` | `ConnectionOptions`)
- `max`: Maximum pool connections (default: `20`)
- `idleTimeoutMillis`: Idle connection timeout (default: `30000`)
- `pgPoolOptions`: Additional pg pool options (PgVector only)

### Default Connection Pool Settings

- Maximum connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

## Features

### Vector Store Features

- Vector similarity search with cosine, euclidean, and dot product (inner) metrics
- Advanced metadata filtering with MongoDB-like query syntax
- Minimum score threshold for queries
- Automatic UUID generation for vectors
- Table management (create, list, describe, delete, truncate)
- Configurable vector index types:
  - **IVFFlat** (default): Balanced speed/accuracy, auto-calculates optimal lists parameter
  - **HNSW**: Fastest queries, higher memory usage, best for large datasets
  - **Flat**: No index, 100% accuracy, best for small datasets (<1000 vectors)

### Storage Features

- Thread and message storage with JSON support
- Atomic transactions for data consistency
- Efficient batch operations
- Rich metadata support
- Timestamp tracking
- Cascading deletes

## Supported Filter Operators

The following filter operators are supported for metadata queries:

- Comparison: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
- Logical: `$and`, `$or`
- Array: `$in`, `$nin`
- Text: `$regex`, `$like`

Example filter:

```typescript
{
  $and: [{ age: { $gt: 25 } }, { tags: { $in: ['tag1', 'tag2'] } }];
}
```

## Vector Index Configuration

pgvector supports three index types, each with different performance characteristics:

### IVFFlat Index (Default)

IVFFlat groups vectors into clusters for efficient searching:

```typescript
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine',
  indexConfig: {
    type: 'ivfflat',
    ivf: {
      lists: 1000, // Number of clusters (default: auto-calculated as sqrt(rows) * 2)
    },
  },
});
```

- **Best for:** Medium to large datasets (10K-1M vectors)
- **Build time:** Minutes for millions of vectors
- **Query speed:** Fast (tens of milliseconds)
- **Memory:** Moderate
- **Accuracy:** ~95-99%

### HNSW Index

HNSW builds a graph structure for extremely fast searches:

```typescript
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'dotproduct', // Recommended for normalized embeddings (OpenAI, etc.)
  indexConfig: {
    type: 'hnsw',
    hnsw: {
      m: 16, // Connections per layer (default: 8, range: 2-100)
      efConstruction: 64, // Dynamic list size (default: 32, range: 4-1000)
    },
  },
});
```

- **Best for:** Large datasets (100K+ vectors) requiring fastest searches
- **Build time:** Can take hours for large datasets
- **Query speed:** Very fast (milliseconds even for millions)
- **Memory:** High (can be 2-3x vector size)
- **Accuracy:** ~99%

**Tuning HNSW:**

- Higher `m`: Better accuracy, more memory (16-32 for high accuracy)
- Higher `efConstruction`: Better index quality, slower builds (64-200 for quality)

### Flat Index (No Index)

Uses sequential scan for 100% accuracy:

```typescript
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine',
  indexConfig: {
    type: 'flat',
  },
});
```

- **Best for:** Small datasets (<1000 vectors) or when 100% accuracy is required
- **Build time:** None
- **Query speed:** Slow for large datasets (linear scan)
- **Memory:** Minimal (just vectors)
- **Accuracy:** 100%

### Distance Metrics

Choose the appropriate metric for your embeddings:

- **`cosine`** (default): Angular similarity, good for text embeddings
- **`euclidean`**: L2 distance, for unnormalized embeddings
- **`dotproduct`**: Dot product, optimal for normalized embeddings (OpenAI, Cohere)

### Index Recreation

The system automatically detects configuration changes and only rebuilds indexes when necessary, preventing the performance issues from unnecessary recreations.

**Important behaviors:**

- If no `indexConfig` is provided, existing indexes are preserved as-is
- If `indexConfig` is provided, indexes are only rebuilt if the configuration differs
- New indexes default to IVFFlat with cosine distance when no config is specified

## Vector Store Methods

- `createIndex({indexName, dimension, metric?, indexConfig?, buildIndex?})`: Create a new table with vector support
- `buildIndex({indexName, metric?, indexConfig?})`: Build or rebuild vector index
- `upsert({indexName, vectors, metadata?, ids?})`: Add or update vectors
- `query({indexName, queryVector, topK?, filter?, includeVector?, minScore?})`: Search for similar vectors
- `listIndexes()`: List all vector-enabled tables
- `describeIndex(indexName)`: Get table statistics and index configuration
- `deleteIndex(indexName)`: Delete a table
- `truncateIndex(indexName)`: Remove all data from a table
- `disconnect()`: Close all database connections

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
- `updateResource({ resourceId, workingMemory })`: Update resource working memory

### Workflow Operations

- `persistWorkflowSnapshot({ workflowName, runId, snapshot })`: Save workflow state
- `loadWorkflowSnapshot({ workflowName, runId })`: Load workflow state
- `listWorkflowRuns({ workflowName, pagination })`: List workflow runs with pagination
- `getWorkflowRunById({ workflowName, runId })`: Get a specific workflow run
- `updateWorkflowState({ workflowName, runId, state })`: Update workflow state
- `updateWorkflowResults({ workflowName, runId, results })`: Update workflow results

### AI Observability Operations

- `createSpan(span)`: Create a single AI span
- `batchCreateSpans({ records })`: Create multiple AI spans
- `updateSpan({ traceId, spanId, updates })`: Update an AI span
- `batchUpdateSpans({ updates })`: Update multiple AI spans
- `getTrace(traceId)`: Get an trace by ID
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

The PostgreSQL store provides comprehensive index management capabilities to optimize query performance.

### Automatic Performance Indexes

PostgreSQL storage automatically creates composite indexes during initialization for common query patterns:

- `mastra_threads_resourceid_createdat_idx`: (resourceId, createdAt DESC)
- `mastra_messages_thread_id_createdat_idx`: (thread_id, createdAt DESC)
- `mastra_traces_name_starttime_idx`: (name, startTime DESC)
- `mastra_evals_agent_name_created_at_idx`: (agent_name, created_at DESC)

These indexes significantly improve performance for filtered queries with sorting.

### Creating Custom Indexes

Create additional indexes to optimize specific query patterns:

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
  columns: ['thread_id', 'createdAt DESC'],
});

// GIN index for JSONB columns (fast JSON queries)
await store.createIndex({
  name: 'idx_traces_attributes',
  table: 'mastra_traces',
  columns: ['attributes'],
  method: 'gin',
});
```

For more advanced use cases, you can also use:

- `unique: true` for unique constraints
- `where: 'condition'` for partial indexes
- `method: 'brin'` for time-series data
- `storage: { fillfactor: 90 }` for update-heavy tables
- `concurrent: true` for non-blocking creation (default)

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
//   columns: ['resourceId', 'createdAt'],
//   unique: false,
//   size: '128 KB',
//   definition: 'CREATE INDEX idx_threads_resource...',
//   method: 'btree',
//   scans: 1542,           // Number of index scans
//   tuples_read: 45230,    // Tuples read via index
//   tuples_fetched: 12050  // Tuples fetched via index
// }

// Drop an index
await store.dropIndex('idx_threads_status');
```

### Index Types and Use Cases

| Index Type          | Best For                                | Storage    | Speed                      |
| ------------------- | --------------------------------------- | ---------- | -------------------------- |
| **btree** (default) | Range queries, sorting, general purpose | Moderate   | Fast                       |
| **hash**            | Equality comparisons only               | Small      | Very fast for `=`          |
| **gin**             | JSONB, arrays, full-text search         | Large      | Fast for contains          |
| **gist**            | Geometric data, full-text search        | Moderate   | Fast for nearest-neighbor  |
| **spgist**          | Non-balanced data, text patterns        | Small      | Fast for specific patterns |
| **brin**            | Large tables with natural ordering      | Very small | Fast for ranges            |

### Index Options

- `name` (required): Index name
- `table` (required): Table name
- `columns` (required): Array of column names (can include DESC/ASC)
- `unique`: Create unique index (default: false)
- `concurrent`: Non-blocking index creation (default: true)
- `where`: Partial index condition
- `method`: Index type ('btree' | 'hash' | 'gin' | 'gist' | 'spgist' | 'brin')
- `opclass`: Operator class for GIN/GIST indexes
- `storage`: Storage parameters (e.g., { fillfactor: 90 })
- `tablespace`: Tablespace name for index placement

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

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
