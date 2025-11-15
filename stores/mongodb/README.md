# @mastra/mongodb

MongoDB storage and vector store implementation for Mastra.

## Installation

```bash
npm install @mastra/mongodb
```

## Prerequisites

- MongoDB 7.0+ (Atlas Local or Atlas Cloud)
- Atlas Search enabled (for vector store)

## Quick Start

### Storage

```typescript
import { MongoDBStore } from '@mastra/mongodb';
import { Mastra } from '@mastra/core/mastra';

// Initialize MongoDBStore
const storage = new MongoDBStore({
  id: 'my-storage-id',
  uri: 'mongodb://localhost:27017',
  dbName: 'mastra',
});

// Configure Mastra
const mastra = new Mastra({
  storage: storage,
});

// Access domain stores
const memoryStore = await storage.getStore('memory');
const workflowsStore = await storage.getStore('workflows');
const evalsStore = await storage.getStore('evals');
const observabilityStore = await storage.getStore('observability');
```

### Vector Store

```typescript
import { MongoDBVector } from '@mastra/mongodb';

const vectorStore = new MongoDBVector({
  uri: 'mongodb://localhost:27017',
  dbName: 'vector_db',
});

await vectorStore.connect();

// Create index
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine',
});

// Upsert vectors
await vectorStore.upsert({
  indexName: 'my_vectors',
  vectors: [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  metadata: [{ text: 'doc1' }, { text: 'doc2' }],
});
```

## Documentation

- [MongoDB Atlas Search Documentation](https://www.mongodb.com/docs/atlas/atlas-search/)
- [MongoDB Node.js Driver](https://mongodb.github.io/node-mongodb-native/)

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API
- [Observability Domain Reference](https://mastra.ai/reference/v1/storage-domains/observability) - Traces and spans API
- [MongoDB Vector Store Reference](https://mastra.ai/reference/v1/vectors/mongodb) - Vector store API
