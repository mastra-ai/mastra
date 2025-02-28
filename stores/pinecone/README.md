# @mastra/pinecone

Vector store implementation for Pinecone, using the official @pinecone-database/pinecone SDK with added telemetry support.

## Installation

```bash
pnpm add @mastra/pinecone
```

## Usage

```typescript
import { PineconeVector } from '@mastra/pinecone';

const vectorStore = new PineconeVector(
  'your-api-key',
  'optional-environment-url'
);

// Create a new index
await vectorStore.createIndex({ indexName: 'my-index', dimension: 1536, metric: 'cosine' });

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({ indexName: 'my-index', vectors, metadata });

// Query vectors
const results = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2, ...],
  topK: 10, // topK
  filter: { text: { $eq: 'doc1' } }, // optional filter
  includeVector: false, // includeValues
});
```

## Configuration

Required:

- `apiKey`: Your Pinecone API key

Optional:

- `environment`: Your Pinecone environment URL (controller host URL)

## Features

- Serverless deployment on AWS (us-east-1)
- Vector similarity search with cosine, euclidean, and dot product metrics
- Automatic batching for large upserts (100 vectors per request)
- Built-in telemetry support
- Metadata filtering
- Optional vector inclusion in query results
- Automatic UUID generation for vectors
- Built on top of @pinecone-database/pinecone SDK

## Methods

- `createIndex({indexName, dimension, metric?})`: Create a new index
- `upsert({indexName, vectors, metadata?, ids?})`: Add or update vectors
- `query({indexName, queryVector, topK?, filter?, includeVector?})`: Search for similar vectors
- `listIndexes()`: List all indexes
- `describeIndex(indexName)`: Get index statistics
- `deleteIndex(indexName)`: Delete an index

## Related Links

- [Pinecone Documentation](https://docs.pinecone.io/)
- [Pinecone Node.js SDK](https://github.com/pinecone-io/pinecone-ts-client)
