---
'@mastra/mongodb': patch
---

Hardened `MongoDBVector` for collections you bring yourself (`collectionName`).

- `deleteIndex()` drops only the search indexes and collections Mastra created. Indexes that already existed, or that earlier versions registered, are kept. A name with no registration now throws instead of dropping a collection.
- `allowWrites` is deprecated and `createIndex({ allowWrites: true })` logs a warning. It still works in this release. Write embeddings into bring-your-own documents from your application, or use `autoEmbed`.
- `createSearchIndex()` reuses an existing full-text index Mastra didn't create when its fields match, and throws a `CONFLICT` error otherwise. It never rewrites that index.
- `createSearchIndex({ fields })` now indexes nested paths such as `metadata.name`. Previously Atlas Search read them as literal field names, so `textQuery()` and `hybridQuery()` matched nothing.
- If `createIndex()` or `createSearchIndex()` fails to create its search index, the registration it wrote is removed or restored.
- When a filter can't run inside `$vectorSearch`, `query()` and `hybridQuery()` throw `TOO_MANY_CANDIDATES` once it matches more than 100,000 documents, instead of loading every matching `_id`.
- On a bring-your-own index, `filterFields` names are declared as written, so `metadataMode: 'document'` filters on them run inside `$vectorSearch`:

```typescript
// Before: declared as metadata.lane. After: declared as lane.
await store.createIndex({
  indexName: 'precedents',
  dimension: 1024,
  collectionName: 'transactions',
  filterFields: ['lane'],
});
```

- `upsert()` and `updateVector()` read the dimension from the index definition instead of counting documents.
- A `__proto__` key in metadata or a filter is kept as a normal field. Previously it was dropped, which could make a filter match every document.
- The missing search index error names the actual collection.
