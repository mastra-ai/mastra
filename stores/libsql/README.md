# @mastra/libsql

LibSQL (SQLite) storage and vector store implementation for Mastra.

## Installation

```bash
npm install @mastra/libsql
```

## Quick Start

### Storage

```typescript
import { LibSQLStore } from '@mastra/libsql';
import { Mastra } from '@mastra/core/mastra';

// Initialize LibSQLStore
const storage = new LibSQLStore({
  id: 'my-storage-id',
  url: 'file:./mastra.db', // Local file, :memory:, or Turso URL
  // Or use: authToken for Turso
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
import { LibSQLVector } from '@mastra/libsql';

const vectorStore = new LibSQLVector({
  url: 'file:./my-db.db',
});

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

## Connection Options

- **Local file**: `'file:./mastra.db'`
- **In-memory**: `':memory:'`
- **Turso**: `'libsql://your-database.turso.io'` (with `authToken`)

## Documentation

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API
- [Observability Domain Reference](https://mastra.ai/reference/v1/storage-domains/observability) - Traces and spans API
- [LibSQLVector Store Reference](https://mastra.ai/reference/v1/vectors/libsql) - Vector store API
