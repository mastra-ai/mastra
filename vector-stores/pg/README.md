# @mastra/vector-pg

Vector store implementation for PostgreSQL with pgvector extension, providing advanced vector similarity search capabilities with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/vector-pg
```

## Prerequisites

- PostgreSQL server with pgvector extension installed
- PostgreSQL 11 or higher

## Usage

```typescript
import { PgVector } from '@mastra/vector-pg';

const vectorStore = new PgVector('postgresql://user:pass@localhost:5432/db');

// Create a new table with vector support
await vectorStore.createIndex('my_vectors', 1536, 'cosine');

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert('my_vectors', vectors, metadata);

// Query vectors
const results = await vectorStore.query(
  'my_vectors',
  [0.1, 0.2, ...],
  10,              // topK
  { text: 'doc1' }, // filter
  false,           // includeVector
  0.5              // minScore
);

// Clean up
await vectorStore.disconnect();
```

## Configuration

The PostgreSQL vector store is initialized with:

- `connectionString`: PostgreSQL connection string

Connection pool settings:

- Maximum connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

## Features

- Vector similarity search with cosine, euclidean, and dot product metrics
- Connection pooling for better performance
- Transaction support for safe operations
- Advanced metadata filtering with MongoDB-like query syntax
- Minimum score threshold for queries
- Automatic UUID generation for vectors
- Table management (create, list, describe, delete, truncate)
- Built-in telemetry support
- Uses pgvector's IVFFLAT indexing with 100 lists

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

## Methods

- `createIndex(indexName, dimension, metric?)`: Create a new table with vector support
- `upsert(indexName, vectors, metadata?, ids?)`: Add or update vectors
- `query(indexName, queryVector, topK?, filter?, includeVector?, minScore?)`: Search for similar vectors
- `listIndexes()`: List all vector-enabled tables
- `describeIndex(indexName)`: Get table statistics
- `deleteIndex(indexName)`: Delete a table
- `truncateIndex(indexName)`: Remove all data from a table
- `disconnect()`: Close all database connections

## Related Links

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
