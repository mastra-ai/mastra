---
'@mastra/mongodb': minor
---

MongoDBVector now supports full-text and hybrid retrieval. `createSearchIndex` provisions an Atlas Search index, `textQuery` runs a BM25 search, and `hybridQuery` fuses vector + text results server-side with $rankFusion (requires MongoDB 8.1+).

**Example**
```ts
await store.createSearchIndex({ indexName: 'precedents', fields: ['note'] });
const hits = await store.hybridQuery({ indexName: 'precedents', queryVector, query: 'shell company', paths: ['note'], topK: 10 });
```
