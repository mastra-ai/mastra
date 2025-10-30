# @mastra/upstash

Upstash provider for Mastra that includes both vector store and database storage capabilities.

## Installation

```bash
npm install @mastra/upstash
```

## Vector Store Usage

```typescript
import { UpstashVector } from '@mastra/upstash';

// In upstash they refer to the store as an index
const vectorStore = new UpstashVector({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_TOKEN
});

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({
  indexName: 'my-namespace',
  vectors,
  metadata
});

// There is no store.createIndex call here, Upstash creates indexes (known as namespaces in Upstash) automatically
// when you upsert if that namespace does not exist yet.

// Query vectors
const results = await vectorStore.query({
  indexName: 'my-namespace',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { text: { $eq: 'doc1' } },
  includeVector: false
});
```

### Hybrid Vector Search (Dense + Sparse)

Upstash supports hybrid search that combines semantic search (dense vectors) with keyword-based search (sparse vectors) for improved relevance and accuracy.

#### Upserting Hybrid Vectors

```typescript
import { UpstashVector } from '@mastra/upstash';

const vectorStore = new UpstashVector({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_TOKEN
});

const vectors = [[0.1, 0.2, 0.3, ...], [0.4, 0.5, 0.6, ...]];
const sparseVectors = [
  { indices: [1, 5, 10], values: [0.8, 0.6, 0.4] },
  { indices: [2, 6, 11], values: [0.7, 0.5, 0.3] }
];
const metadata = [{ title: 'Document 1' }, { title: 'Document 2' }];

const ids = await vectorStore.upsert({
  indexName: 'hybrid-index',
  vectors,
  sparseVectors,
  metadata
});
```

#### Querying with Hybrid Search

```typescript
import { FusionAlgorithm, QueryMode } from '@upstash/vector';

// Query with both dense and sparse vectors (default hybrid mode)
const results = await vectorStore.query({
  indexName: 'hybrid-index',
  queryVector: [0.1, 0.2, 0.3, ...],
  sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
  topK: 10,
  fusionAlgorithm: FusionAlgorithm.RRF,
  includeVector: false
});

// Dense-only query (backward compatible)
const denseResults = await vectorStore.query({
  indexName: 'hybrid-index',
  queryVector: [0.1, 0.2, 0.3, ...],
  topK: 10
});

// Query only the dense component for custom reranking
const denseOnlyResults = await vectorStore.query({
  indexName: 'hybrid-index',
  queryVector: [0.1, 0.2, 0.3, ...],
  queryMode: QueryMode.DENSE,
  topK: 10
});

// Query only the sparse component for custom reranking
const sparseOnlyResults = await vectorStore.query({
  indexName: 'hybrid-index',
  queryVector: [0.1, 0.2, 0.3, ...],              // Still needed for dense index structure
  sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
  queryMode: QueryMode.SPARSE,
  topK: 10
});

// Explicit hybrid mode (same as default)
const explicitHybridResults = await vectorStore.query({
  indexName: 'hybrid-index',
  queryVector: [0.1, 0.2, 0.3, ...],
  sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
  queryMode: QueryMode.HYBRID,
  fusionAlgorithm: FusionAlgorithm.RRF,
  topK: 10
});
```

#### Fusion Algorithms & Query Modes

Upstash provides built-in fusion algorithms to combine dense and sparse search results:

- **RRF (Reciprocal Rank Fusion)**: Default algorithm that combines rankings from both dense and sparse searches
- **DBSF (Distribution-Based Score Fusion)**

Query modes enable fine-grained control over hybrid index queries:

- **`QueryMode.HYBRID`**: Default mode that queries both dense and sparse components and fuses results
- **`QueryMode.DENSE`**: Query only the dense component, useful for custom reranking scenarios
- **`QueryMode.SPARSE`**: Query only the sparse component, useful for custom reranking scenarios

Use query modes when you want to implement custom fusion logic or need separate dense/sparse results for advanced reranking algorithms.

### Vector Store Configuration

The Upstash vector store requires the following configuration:

- `UPSTASH_VECTOR_REST_URL`: Your Upstash Vector REST URL
- `UPSTASH_VECTOR_TOKEN`: Your Upstash Vector REST token
- `UPSTASH_INDEX`: Name of the index to use

## Database Storage Usage

```typescript
import { UpstashStore } from '@mastra/upstash';

const store = new UpstashStore({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
```

### Database Storage Configuration

The Upstash store requires the following configuration:

- `UPSTASH_REDIS_REST_URL`: Your Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Your Upstash Redis REST token

## Features

- Serverless vector database and key-value store
- **Hybrid vector search** combining dense and sparse vectors
- **Advanced fusion algorithms** (RRF) for optimal search ranking
- Pay-per-use pricing
- Low latency global access
- REST API interface
- Built-in vector similarity search
- Durable storage for chat history and agent memory
- Backward compatible with existing dense vector implementations

## Related Links

- [Upstash Vector Documentation](https://docs.upstash.com/vector)
- [Upstash Hybrid Indexes Documentation](https://docs.upstash.com/vector/features/hybridindexes)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
