---
'@mastra/mongodb': minor
---

MongoDBVector now supports full-text and hybrid retrieval. `createSearchIndex` provisions an Atlas Search index, `textQuery` runs a BM25 search, and `hybridQuery` fuses vector + text results server-side with $rankFusion (requires MongoDB 8.1+).

A custom or field-restricted text-search index name is now persisted and resolved automatically by `textQuery`/`hybridQuery` (with a per-call override), so a `searchIndexName` passed to `createSearchIndex` is reachable; when `fields` is supplied without an explicit name, the field-mapped index is created under a distinct name so its mapping is not shadowed by the auto-created dynamic index. `hybridQuery`'s vector branch now reuses the same pushdown-vs-fallback filter logic as `query`, so metadata filters on undeclared fields no longer hard-error on bring-your-own collections.

**Example**
```ts
await store.createSearchIndex({ indexName: 'precedents', fields: ['note'] });
const hits = await store.hybridQuery({ indexName: 'precedents', queryVector, query: 'shell company', paths: ['note'], topK: 10 });
```
