# @mastra/surrealdb

SurrealDB provider for Mastra: storage for memory (including observational memory), workflows, scores and traces, plus a vector store backed by SurrealDB HNSW indexes. Requires SurrealDB v3.

## Installation

```bash
npm install @mastra/surrealdb
```

## Usage

### Storage

```typescript
import { Mastra } from '@mastra/core/mastra';
import { SurrealDBStore } from '@mastra/surrealdb';

const storage = new SurrealDBStore({
  id: 'surrealdb-storage',
  url: 'ws://localhost:8000',
  username: 'root',
  password: 'root',
  namespace: 'mastra',
  database: 'my_app',
});

const mastra = new Mastra({ storage });
```

Connect with a token (`token`), a namespace or database user (`authLevel: 'namespace' | 'database'`), or an existing `Surreal` client (`db`).

### Vector Store

```typescript
import { SurrealVector } from '@mastra/surrealdb';

const vector = new SurrealVector({
  id: 'surrealdb-vector',
  url: 'ws://localhost:8000',
  username: 'root',
  password: 'root',
});

await vector.createIndex({ indexName: 'docs', dimension: 1536, metric: 'cosine' });

await vector.upsert({
  indexName: 'docs',
  vectors: [[0.1, 0.2 /* ... */]],
  metadata: [{ text: 'doc1', source: 'faq' }],
});

const results = await vector.query({
  indexName: 'docs',
  queryVector: [0.1, 0.2 /* ... */],
  topK: 5,
  filter: { source: 'faq' },
});
```

To share one connection with the storage, pass `connector: storage.connector` instead of connection options.

## Documentation

- [SurrealDB integration guide](https://mastra.ai/integrations/databases/surrealdb)
- [SurrealDB vector store](https://mastra.ai/integrations/vectors/surrealdb)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/surrealdb/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
