# @mastra/milvus

Vector store implementation for Milvus, using the official @milvus-io/milvus2-sdk-node SDK.

## Installation

```bash
pnpm add @mastra/milvus
```

## Usage

```typescript
import { MilvusStore } from '@mastra/milvus';

// Create a new Milvus store
const store = new MilvusStore({
  uri: 'localhost:19530',
  username: 'optional-username',
  password: 'optional-password',
  secure: false
});

// Initialize with dimension
await store.initialize({ dimension: 1536 });

// Insert documents
await store.insert({
  documents: [
    { id: 'doc1', values: [0.1, 0.2, ...], metadata: { text: 'content1' } },
    { id: 'doc2', values: [0.3, 0.4, ...], metadata: { text: 'content2' } },
  ]
});

// Query documents
const results = await store.query({
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { eq: ['text', 'content1'] }
});
```

## Configuration

Required:

- `uri`: URI to your Milvus instance (default: 'localhost:19530')

Optional:

- `username`: Username for authentication
- `password`: Password for authentication
- `secure`: Whether to use SSL/TLS (default: false)
- `collectionName`: Name of the collection (default: 'mastra_collection')
- `dimension`: Vector dimension (default: 1536)
- `metricType`: Similarity metric ('L2', 'IP', or 'COSINE') (default: 'COSINE')

## Features

- Vector similarity search with L2, IP, and COSINE metrics
- Metadata filtering support
- Authentication support
- Connection pooling for better performance
- Automatic collection creation

## Methods

- `initialize({ dimension })`: Initialize the store with the specified dimension
- `insert({ documents })`: Insert documents into the store
- `query({ queryVector, topK, filter })`: Query for similar vectors
- `delete({ ids, filter })`: Delete documents by ID or filter
- `close()`: Close the connection to Milvus

## Related Links

- [Milvus Documentation](https://milvus.io/docs)
- [Milvus Node.js SDK](https://github.com/milvus-io/milvus-sdk-node)
