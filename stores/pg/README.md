# @mastra/pg

PostgreSQL storage and vector store implementation for Mastra with pgvector support.

## Installation

```bash
npm install @mastra/pg
```

## Prerequisites

- PostgreSQL 11 or higher
- pgvector extension (for vector store)

## Quick Start

### Storage

```typescript
import { PostgresStore } from '@mastra/pg';
import { Mastra } from '@mastra/core/mastra';

// Initialize PostgresStore
const storage = new PostgresStore({
  id: 'my-storage-id',
  connectionString: 'postgresql://user:pass@localhost:5432/db',
  // Or use: host, port, database, user, password
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
import { PgVector } from '@mastra/pg';

const vectorStore = new PgVector({
  connectionString: 'postgresql://user:pass@localhost:5432/db',
});

// Create index
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine',
  indexConfig: {
    type: 'hnsw',
    hnsw: { m: 16, efConstruction: 64 },
  },
});

// Upsert vectors
await vectorStore.upsert({
  indexName: 'my_vectors',
  vectors: [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  metadata: [{ text: 'doc1' }, { text: 'doc2' }],
});
```

## Configuration

### Connection Methods

1. **Connection String** (Recommended)

   ```typescript
   {
     connectionString: 'postgresql://user:pass@localhost:5432/db';
   }
   ```

2. **Host/Port/Database**
   ```typescript
   { host: 'localhost', port: 5432, database: 'mydb', user: 'postgres', password: 'password' }
   ```

### Optional Configuration

- `schemaName`: Custom PostgreSQL schema (default: `public`)
- `ssl`: Enable SSL or provide custom SSL options
- `max`: Maximum pool connections (default: `20`)
- `idleTimeoutMillis`: Idle connection timeout (default: `30000`)

## Vector Index Types

- **IVFFlat** (default): Balanced speed/accuracy for medium to large datasets
- **HNSW**: Fastest queries, best for large datasets (100K+ vectors)
- **Flat**: 100% accuracy, best for small datasets (<1000 vectors)

## Documentation

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API
- [Observability Domain Reference](https://mastra.ai/reference/v1/storage-domains/observability) - Traces and spans API
- [PG Vector Store Reference](https://mastra.ai/reference/v1/vectors/pg) - Vector store API

## Related Links

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
