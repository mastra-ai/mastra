# @mastra/upstash

Upstash storage and vector store implementation for Mastra.

## Installation

```bash
npm install @mastra/upstash
```

## Quick Start

### Storage

```typescript
import { UpstashStore } from '@mastra/upstash';
import { Mastra } from '@mastra/core/mastra';

// Initialize UpstashStore
const storage = new UpstashStore({
  id: 'my-storage-id',
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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
import { UpstashVector } from '@mastra/upstash';

const vectorStore = new UpstashVector({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_TOKEN!,
});

// Upsert vectors (indexes are created automatically)
await vectorStore.upsert({
  indexName: 'my-namespace',
  vectors: [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  metadata: [{ text: 'doc1' }, { text: 'doc2' }],
});
```

## Documentation

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API
- [Upstash Vector Store Reference](https://mastra.ai/reference/v1/vectors/upstash) - Vector store API

## Related Links

- [Upstash Documentation](https://docs.upstash.com/)
