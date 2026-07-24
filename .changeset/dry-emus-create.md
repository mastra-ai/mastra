---
'@mastra/mongodb': minor
---

MongoDBVector can now index an existing (operational) collection instead of a managed one. Pass `collectionName` (and optionally `searchIndexName`) to `createIndex`, and query with `metadataMode: 'document'` to get the full source document back as metadata.

The bring-your-own index target (collection name, search-index name, and the `isByo` safety flag) is now persisted durably in a mastra-owned registry collection and hydrated on demand, so BYO classification survives a process restart: `deleteIndex` from a fresh process drops only the Atlas search index and never drops the caller's operational collection. `listIndexes` now returns **logical** Mastra index names (not physical collection names), so its output round-trips correctly back into `deleteIndex`/`describeIndex`. `metadataMode: 'document'` now returns a clean source document (the synthetic relevance score is no longer merged into `metadata`, so a real source field named `score` is preserved).

**Example**

```ts
await vectorStore.createIndex({ indexName: 'precedents', dimension: 1024, collectionName: 'transactions' });
const hits = await vectorStore.query({ indexName: 'precedents', queryVector, metadataMode: 'document' });
```
