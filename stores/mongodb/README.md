# @mastra/mongodb

MongoDB Atlas Search implementation for Mastra, providing vector similarity search and index management using MongoDB Atlas Local or Atlas Cloud.

## Installation

```bash
npm install @mastra/mongodb
```

## Prerequisites

- MongoDB Atlas Local (via Docker) or MongoDB Atlas Cloud instance with Atlas Search enabled
- MongoDB 7.0+ recommended

## Usage

### Vector Store

```typescript
import { MongoDBVector } from '@mastra/mongodb';

const vectorDB = new MongoDBVector({
  uri: 'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true',
  dbName: 'vector_db',
});

// Connect to MongoDB
await vectorDB.connect();

// Create a new vector index (collection)
await vectorDB.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine', // or 'euclidean', 'dotproduct'
});

// Upsert vectors
const ids = await vectorDB.upsert({
  indexName: 'my_vectors',
  vectors: [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  metadata: [{ text: 'doc1' }, { text: 'doc2' }],
});

// Query vectors
const results = await vectorDB.query({
  indexName: 'my_vectors',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { text: 'doc1' },
  includeVector: false,
  minScore: 0.5,
});

// Clean up
await vectorDB.disconnect();
```

### Storage

```typescript
import { MongoDBStore } from '@mastra/mongodb';

const store = new MongoDBStore({
  uri: 'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true',
  dbName: 'mastra',
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

The MongoDB vector store is initialized with:

- `uri`: MongoDB connection string (with credentials and options)
- `dbName`: Name of the database to use

Example:

```typescript
const vectorDB = new MongoDBVector({
  uri: 'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true',
  dbName: 'vector_db',
});
```

## Features

### Vector Store Features

- Vector similarity search with cosine, euclidean, and dotproduct metrics (Atlas Search)
- Metadata filtering with MongoDB-style query syntax
- Minimum score threshold for queries
- Automatic UUID generation for vectors
- Collection (index) management: create, list, describe, delete
- Atlas Search readiness checks for reliable testing

### Storage Features

- Thread and message storage with JSON support
- Efficient batch operations
- Rich metadata support
- Timestamp tracking

## Supported Filter Operators

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

## Distance Metrics

The following distance metrics are supported:

- `cosine` → Cosine similarity (default)
- `euclidean` → Euclidean distance
- `dotproduct` → Dot product

## Vector Store Methods

- `createIndex({indexName, dimension, metric})`: Create a new collection with vector search support
- `upsert({indexName, vectors, metadata?, ids?})`: Add or update vectors
- `query({indexName, queryVector, topK?, filter?, includeVector?, minScore?, documentFilter?})`: Search for similar vectors (optionally filter by document content)

> **Note:** `documentFilter` allows filtering results based on the content of the `document` field. Example: `{ $contains: 'specific text' }` will return only vectors whose associated document contains the specified text.

- `listIndexes()`: List all vector-enabled collections
- `describeIndex(indexName)`: Get collection statistics (dimension, count, metric)
- `updateIndexById(indexName, id, { vector?, metadata? })`: Update a vector and/or its metadata by ID
- `deleteIndexById(indexName, id)`: Delete a vector by ID
- `deleteIndex(indexName)`: Delete a collection
- `disconnect()`: Close the MongoDB connection

## Storage Methods

- `saveThread(thread)`: Create or update a thread
- `getThread(threadId)`: Get a thread by ID
- `deleteThread(threadId)`: Delete a thread and its messages
- `saveMessages(messages)`: Save multiple messages in a transaction
- `getMessages(threadId)`: Get all messages for a thread
- `deleteMessages(messageIds)`: Delete specific messages

## Query Response Format

Each query result includes:

- `id`: Vector ID
- `score`: Similarity score (higher is more similar)
- `metadata`: Associated metadata
- `vector`: Original vector (if `includeVector` is true)

## Testing

Integration tests use MongoDB Atlas Local via Docker. See `docker-compose.yml` for setup. The test suite includes readiness checks for Atlas Search before running vector operations.

## Related Links

- [MongoDB Atlas Search Documentation](https://www.mongodb.com/docs/atlas/atlas-search/)
- [MongoDB Node.js Driver](https://mongodb.github.io/node-mongodb-native/)
