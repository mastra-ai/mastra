# @mastra/pg

SQLite implementation for Mastra, providing both vector similarity search and general storage capabilities with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/libsql
```

## Usage

### Vector Store

```typescript
import { LibSQLVector } from '@mastra/libsql';

const vectorStore = new LibSQLVector({
  url: 'file:./my-db.db'
});

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
```

### Storage

```typescript
import { LibSQLStore } from '@mastra/pg';

const store = new LibSQLStore({
  url: 'file:./my-db.db',
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

The LibSQLStore store can be initialized with:

- Configuration object with url and auth. Auth is only necessary when using a provider like [Turso](https://turso.tech/)

## Features

### Vector Store Features

- Vector similarity search with cosine, euclidean, and dot product metrics
- Advanced metadata filtering with MongoDB-like query syntax
- Minimum score threshold for queries
- Automatic UUID generation for vectors
- Table management (create, list, describe, delete, truncate)

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

## Storage Methods

- `saveThread(thread)`: Create or update a thread
- `getThread(threadId)`: Get a thread by ID
- `deleteThread(threadId)`: Delete a thread and its messages
- `saveMessages(messages)`: Save multiple messages in a transaction
- `getMessages(threadId)`: Get all messages for a thread
- `deleteMessages(messageIds)`: Delete specific messages

## Related Links

- [LibSQL Documentation](https://docs.turso.tech/sdk/introductionh)
