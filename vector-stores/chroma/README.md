# @mastra/vector-chroma

Vector store implementation for ChromaDB using the official chromadb client with added dimension validation and collection management.

## Installation

```bash
npm install @mastra/vector-chroma
```

## Usage

```typescript
import { ChromaVector } from '@mastra/vector-chroma';

const vectorStore = new ChromaVector({
  path: 'http://localhost:8000',  // ChromaDB server URL
  auth: {                         // Optional authentication
    provider: 'token',
    credentials: 'your-token'
  }
});

// Create a new collection
await vectorStore.createIndex('my-collection', 1536, 'cosine');

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert('my-collection', vectors, metadata);

// Query vectors
const results = await vectorStore.query(
  'my-collection',
  [0.1, 0.2, ...],
  10, // topK
  { text: { $eq: 'doc1' } }, // optional filter
  false // includeVector
);
```

## Configuration

Required:

- `path`: URL of your ChromaDB server

Optional:

- `auth`: Authentication configuration
  - `provider`: Authentication provider
  - `credentials`: Authentication credentials

## Features

- Vector similarity search with cosine, euclidean, and dot product metrics
- Strict vector dimension validation
- Collection-based organization
- Metadata filtering support
- Optional vector inclusion in query results
- Automatic UUID generation for vectors
- Built-in collection caching for performance
- Built on top of chromadb client

## Methods

- `createIndex(indexName, dimension, metric?)`: Create a new collection
- `upsert(indexName, vectors, metadata?, ids?)`: Add or update vectors
- `query(indexName, queryVector, topK?, filter?, includeVector?)`: Search for similar vectors
- `listIndexes()`: List all collections
- `describeIndex(indexName)`: Get collection statistics
- `deleteIndex(indexName)`: Delete a collection

## Query Response Format

Query results include:

- `id`: Vector ID
- `score`: Distance/similarity score
- `metadata`: Associated metadata
- `vector`: Original vector (if includeVector is true)

## Related Links

- [ChromaDB Documentation](https://docs.trychroma.com/)
- [ChromaDB API Reference](https://docs.trychroma.com/api/client)
