# @mastra/vector-libsql

Vector store implementation for libSQL/Turso using the official @libsql/client with support for vector similarity search and advanced JSON filtering.

## Installation

```bash
npm install @mastra/vector-libsql
```

## Usage

```typescript
import { LibSQLVector } from '@mastra/vector-libsql';

const vectorStore = new LibSQLVector({
  connectionUrl: 'libsql://your-database.turso.io',
  authToken: 'your-auth-token',       // optional
  syncUrl: 'your-sync-url',           // optional
  syncInterval: 1000                  // optional
});

// Create a new table
await vectorStore.createIndex('my_vectors', 1536);

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
```

## Configuration

Required:

- `connectionUrl`: URL of your libSQL/Turso database

Optional:

- `authToken`: Authentication token for Turso
- `syncUrl`: URL for database synchronization
- `syncInterval`: Sync interval in milliseconds

## Features

- Vector similarity search using cosine distance
- Advanced JSON metadata filtering
- Support for nested object traversal in filters
- Array contains operations
- Minimum score threshold for queries
- Automatic UUID generation for vectors
- Table management (create, list, describe, delete, truncate)
- Built on top of @libsql/client
- Support for Turso's sync functionality

## Supported Filter Operations

### Basic Operations

- Equality: `{ field: value }`
- Comparison: `{ field: { $gt, $gte, $lt, $lte, $ne } }`
- Array: `{ field: { $in: [...] } }`

### Advanced Operations

- Contains (Objects):

```typescript
{
  metadata: {
    contains: {
      nested: {
        field: 'value';
      }
    }
  }
}
```

- Contains (Arrays):

```typescript
{
  tags: {
    contains: ['tag1', 'tag2'];
  }
}
```

## Methods

- `createIndex(indexName, dimension)`: Create a new table
- `upsert(indexName, vectors, metadata?, ids?)`: Add or update vectors
- `query(indexName, queryVector, topK?, filter?, includeVector?, minScore?)`: Search for similar vectors
- `listIndexes()`: List all vector tables
- `describeIndex(indexName)`: Get table statistics
- `deleteIndex(indexName)`: Delete a table
- `truncateIndex(indexName)`: Remove all data from a table

## Related Links

- [libSQL Documentation](https://github.com/tursodatabase/libsql)
- [Turso Documentation](https://docs.turso.tech)
- [@libsql/client Documentation](https://github.com/tursodatabase/libsql/tree/main/clients/typescript)
