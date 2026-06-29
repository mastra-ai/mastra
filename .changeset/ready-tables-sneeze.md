---
'@mastra/meilisearch': minor
---

Added `@mastra/meilisearch`, a vector store for semantic recall and RAG backed by [Meilisearch](https://www.meilisearch.com/) (GA vector search, v1.13+).

It implements the standard `MastraVector` interface, so it drops into the same places as the other vector stores:

```typescript
import { MeilisearchVector } from '@mastra/meilisearch';

const store = new MeilisearchVector({
  id: 'meilisearch',
  host: process.env.MEILISEARCH_HOST, // e.g. 'http://localhost:7700'
  apiKey: process.env.MEILISEARCH_API_KEY,
});

await store.createIndex({ indexName: 'docs', dimension: 1536 });

await store.upsert({
  indexName: 'docs',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
});

const results = await store.query({
  indexName: 'docs',
  queryVector: embedding,
  topK: 5,
  filter: { category: 'electronics' },
});
```

Mastra supplies the embeddings, so the store configures each index with a `userProvided` embedder and never embeds text itself. Similarity is cosine, and each result's `score` is Meilisearch's `_rankingScore`. MongoDB-style metadata filters are supported (`$eq`, `$ne`, `$gt`/`$gte`/`$lt`/`$lte`, `$in`, `$nin`, `$all`, `$and`, `$or`, `$not`, `$nor`, `$exists`); operators Meilisearch can't express (`$regex`, `$contains`, `$elemMatch`, `$size`) are not supported.
