# @mastra/lance

LanceDB storage and vector store implementation for Mastra.

## Installation

```bash
pnpm add @mastra/lance @lancedb/lancedb apache-arrow
```

## Quick Start

### Storage

```typescript
import { LanceStorage } from '@mastra/lance';
import { Mastra } from '@mastra/core/mastra';

// Initialize LanceStorage
const storage = await LanceStorage.create(
  'my-storage-id',
  'MyStorage',
  'path/to/db', // Local path, LanceDB Cloud URI, or S3 bucket
);

// Configure Mastra
const mastra = new Mastra({
  storage: storage,
});

// Access domain stores
const memoryStore = await storage.getStore('memory');
const workflowsStore = await storage.getStore('workflows');
const evalsStore = await storage.getStore('evals');
```

### Vector Store

```typescript
import { LanceVectorStore } from '@mastra/lance';

const vectorStore = await LanceVectorStore.create({
  uri: 'path/to/vector-db',
  tableName: 'embeddings',
});

// Create index
await vectorStore.createIndex({
  indexName: 'embeddings',
  dimension: 384,
  metric: 'cosine',
});

// Upsert vectors
await vectorStore.upsert({
  indexName: 'embeddings',
  vectors: [
    {
      id: 'vec-001',
      values: new Float32Array([0.1, 0.2, 0.3]),
      metadata: { text: 'Hello world' },
    },
  ],
});
```

## Connection Options

- **Local database**: `'/path/to/db'`
- **LanceDB Cloud**: `'db://host:port'`
- **S3 bucket**: `'s3://bucket/db'` (with optional `storageOptions`)

## Documentation

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API
- [Lance Vector Store Reference](https://mastra.ai/reference/v1/vectors/lance) - Vector store API

## Limitations

- Message deletion (`deleteMessages`) is not currently supported
- AI Observability (traces/spans) is not currently supported
