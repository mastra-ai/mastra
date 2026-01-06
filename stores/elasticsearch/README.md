# @mastra/elasticsearch

ElasticSearch vector store implementation for Mastra, providing vector similarity search and index management using ElasticSearch 8.x+.

## Installation

```bash
npm install @mastra/elasticsearch
```

## Prerequisites

- ElasticSearch 8.x+ instance
- Dense vector support enabled (included by default in ES 8.x)

## Usage

### Vector Store

```typescript
import { ElasticSearchVector } from '@mastra/elasticsearch';

const vectorDB = new ElasticSearchVector({
  url: 'http://localhost:9200',
  id: 'my-vector-store',
});

// Create a new vector index
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
});

// Update vectors
await vectorDB.updateVector({
  indexName: 'my_vectors',
  id: 'vector-id',
  update: {
    vector: [0.5, 0.6, ...],
    metadata: { text: 'updated' },
  },
});

// Delete vectors
await vectorDB.deleteVector({
  indexName: 'my_vectors',
  id: 'vector-id',
});

// Bulk delete by filter
await vectorDB.deleteVectors({
  indexName: 'my_vectors',
  filter: { source: 'old-document.pdf' },
});
```

## Configuration

The ElasticSearchVector store can be initialized with:

- `url`: The ElasticSearch node URL (required)
- `id`: A unique identifier for the vector store instance (required)

## Features

### Vector Store Features

- **Create Index**: Create vector indexes with specified dimensions and similarity metrics
- **Upsert**: Insert or update vectors with optional metadata
- **Query**: Search for similar vectors with optional filtering
- **Update**: Update vector embeddings and/or metadata by ID or filter
- **Delete**: Remove vectors by ID or filter
- **List Indexes**: List all vector indexes
- **Describe Index**: Get index statistics (dimension, count, metric)

### Supported Similarity Metrics

- `cosine`: Cosine similarity (default)
- `euclidean`: L2 (Euclidean) distance
- `dotproduct`: Dot product similarity

### Filter Operators

The following filter operators are supported:

- **Comparison**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
- **Array**: `$in`, `$nin`, `$all`
- **Logical**: `$and`, `$or`, `$not`
- **Element**: `$exists`
- **Regex**: `$regex`

## Development

### Running Tests

```bash
# Start ElasticSearch container
docker compose up -d

# Run tests
pnpm test

# Stop container
docker compose down -v
```

## License

MIT
