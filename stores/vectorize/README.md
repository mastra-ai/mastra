# @mastra/vectorize

Vector store implementation for Vectorize, a managed vector database service optimized for AI applications.

## Installation

```bash
npm install @mastra/vectorize
```

## Usage

```typescript
import { VectorizeStore } from '@mastra/vectorize';

const vectorStore = new VectorizeStore({
  apiKey: process.env.VECTORIZE_API_KEY,
  projectId: process.env.VECTORIZE_PROJECT_ID
});

// Create a new index
await vectorStore.createIndex({
  indexName: 'my-index',
  dimension: 1536,
  metric: 'cosine'
});

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({
  indexName: 'my-index',
  vectors,
  metadata
});

// Query vectors
const results = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { text: { $eq: 'doc1' } },
  includeVector: false
});
```

## Configuration

The Vectorize vector store requires the following configuration:

- `VECTORIZE_API_KEY`: Your Vectorize API key
- `VECTORIZE_INDEX_NAME`: Name of the index to use
- `VECTORIZE_PROJECT_ID`: Your Vectorize project ID

## Features

- Purpose-built for AI and ML workloads
- High-performance vector similarity search
- Automatic index optimization
- Scalable architecture
- Real-time updates and queries

## Methods

- `createIndex({ indexName, dimension, metric? })`: Create a new index
- `upsert({ indexName, vectors, metadata?, ids? })`: Add or update vectors
- `query({ indexName, queryVector, topK?, filter?, includeVector? })`: Search for similar vectors
- `listIndexes()`: List all indexes
- `describeIndex(indexName)`: Get index statistics
- `deleteIndex(indexName)`: Delete an index

## Related Links

- [Vectorize Documentation](https://www.vectorize.com/docs)
