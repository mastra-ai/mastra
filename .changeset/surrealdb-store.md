---
'@mastra/surrealdb': minor
---

Added `@mastra/surrealdb`, a SurrealDB provider for Mastra. It stores memory (threads, messages, working memory and observational memory), workflow snapshots, scores and traces in SurrealDB v3. It also includes `SurrealVector`, a vector store built on SurrealDB HNSW indexes that applies metadata filters during the search.

```ts
import { Mastra } from '@mastra/core/mastra';
import { SurrealDBStore, SurrealVector } from '@mastra/surrealdb';

const storage = new SurrealDBStore({
  id: 'surrealdb-storage',
  url: 'ws://localhost:8000',
  username: 'root',
  password: 'root',
});

// Shares the storage connection
const vector = new SurrealVector({ id: 'surrealdb-vector', connector: storage.connector });

const mastra = new Mastra({ storage, vectors: { surrealdb: vector } });
```

**Moving from `@surrealdb/mastra-ai`.** This package replaces the community `@surrealdb/mastra-ai` storage adapter. Threads, messages and resources it wrote are read as before. Workflow snapshots, traces and observational memory use a new layout: point the store at a new database, or remove the `mastra_workflow_snapshot`, `mastra_ai_spans` and `mastra_observational_memory` tables before switching.
