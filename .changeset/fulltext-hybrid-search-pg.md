---
'@mastra/pg': minor
---

Add full-text and hybrid search support to PgVector (#10453).

`createIndex` accepts a `fullTextSearch` option to enable a `content` column and GIN tsvector index. Queries support `searchMode: 'fulltext'` (keyword-only, no embedding needed) and `searchMode: 'hybrid'` (vector + keyword).

```ts
import { PgVector } from '@mastra/pg';

const pg = new PgVector({ connectionString: process.env.DATABASE_URL });

// Create index with full-text search
await pg.createIndex({
  indexName: 'docs',
  dimension: 1536,
  fullTextSearch: { language: 'english' },
});

// Upsert with document text for keyword indexing
await pg.upsert({
  indexName: 'docs',
  vectors: embeddings,
  metadata: chunks.map(c => ({ source: 'readme.md' })),
  documents: chunks.map(c => c.text),
});

// Full-text search (keyword-only)
const ftResults = await pg.query({
  indexName: 'docs',
  queryVector: [],
  searchMode: 'fulltext',
  queryText: 'authentication',
  topK: 10,
});

// Hybrid search (vector + keyword)
const hybridResults = await pg.query({
  indexName: 'docs',
  queryVector: embedding,
  searchMode: 'hybrid',
  queryText: 'authentication',
  hybridConfig: { semanticWeight: 0.7, keywordWeight: 0.3 },
  topK: 10,
});
```
