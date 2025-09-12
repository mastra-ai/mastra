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

```typescript
import { PgVector } from '@mastra/pg';

const vectorStore = new PgVector({ connectionString: 'postgresql://user:pass@localhost:5432/db' });

// Create a new table with vector support
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine',
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
  id: 'thread-123',
  resourceId: 'resource-456',
  title: 'My Thread',
  metadata: { key: 'value' },
});

// Add messages to thread
await store.saveMessages([
  {
    id: 'msg-789',
    threadId: 'thread-123',
    role: 'user',
    type: 'text',
    content: [{ type: 'text', text: 'Hello' }],
  },
]);

// Query threads and messages
const savedThread = await store.getThread('thread-123');
const messages = await store.getMessages('thread-123');
```

## Configuration

The PostgreSQL store can be initialized with either:

- `connectionString`: PostgreSQL connection string (for vector store)
- Configuration object with host, port, database, user, and password (for storage)

Connection pool settings:

- Maximum connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

## Features

### Vector Store Features

- Vector similarity search with cosine, euclidean, and dot product metrics
- Advanced metadata filtering with MongoDB-like query syntax
- Minimum score threshold for queries
- Automatic UUID generation for vectors
- Table management (create, list, describe, delete, truncate)
- Uses pgvector's IVFFLAT indexing with 100 lists by default
- Supports HNSW indexing with configurable parameters
- Supports flat indexing

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

## Vector Store Methods

- `createIndex({indexName, dimension, metric?, indexConfig?, defineIndex?})`: Create a new table with vector support
- `upsert({indexName, vectors, metadata?, ids?})`: Add or update vectors
- `query({indexName, queryVector, topK?, filter?, includeVector?, minScore?})`: Search for similar vectors
- `defineIndex({indexName, metric?, indexConfig?})`: Define an index
- `listIndexes()`: List all vector-enabled tables
- `describeIndex(indexName)`: Get table statistics
- `deleteIndex(indexName)`: Delete a table
- `truncateIndex(indexName)`: Remove all data from a table
- `disconnect()`: Close all database connections

## Storage Methods

- `saveThread(thread)`: Create or update a thread
- `getThread(threadId)`: Get a thread by ID
- `deleteThread(threadId)`: Delete a thread and its messages
- `saveMessages(messages)`: Save multiple messages in a transaction
- `getMessages(threadId)`: Get all messages for a thread
- `deleteMessages(messageIds)`: Delete specific messages

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

```typescript
// Basic index
await store.createIndex({
  name: 'idx_threads_resource',
  table: 'mastra_threads',
  columns: ['resourceId'],
});

// Composite index with sort order
await store.createIndex({
  name: 'idx_messages_composite',
  table: 'mastra_messages',
  columns: ['thread_id', 'createdAt DESC'],
});

// Unique index
await store.createIndex({
  name: 'idx_unique_email',
  table: 'mastra_resources',
  columns: ['email'],
  unique: true,
});

// Partial index with WHERE clause
await store.createIndex({
  name: 'idx_active_threads',
  table: 'mastra_threads',
  columns: ['resourceId'],
  where: '"status" = \'active\'',
});

// GIN index for JSONB columns
await store.createIndex({
  name: 'idx_traces_attributes',
  table: 'mastra_traces',
  columns: ['attributes'],
  method: 'gin',
});

// BRIN index for time-series data
await store.createIndex({
  name: 'idx_threads_created_brin',
  table: 'mastra_threads',
  columns: ['createdAt'],
  method: 'brin',
});

// Index with storage parameters
await store.createIndex({
  name: 'idx_optimized',
  table: 'mastra_messages',
  columns: ['thread_id'],
  storage: {
    fillfactor: 90, // Leave 10% free space for updates
  },
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

### Performance Best Practices

1. **Index Selection**:
   - Use **btree** for most queries (supports `<`, `>`, `=`, `BETWEEN`)
   - Use **hash** for simple equality checks on large tables
   - Use **gin** for JSONB queries and array contains operations
   - Use **brin** for time-series data with natural ordering

2. **Monitoring**:
   - Use `describeIndex()` to track index usage statistics
   - Regularly review index scans to identify unused indexes
   - Check index sizes to monitor storage overhead

3. **Trade-offs**:
   - Indexes speed up reads but slow down writes
   - Each index requires additional storage
   - Too many indexes can degrade overall performance
   - CONCURRENT creation avoids table locks but takes longer

## Related Links

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
