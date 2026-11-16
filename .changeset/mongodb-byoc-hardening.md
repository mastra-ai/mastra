---
'@mastra/mongodb': minor
---

Hardened `MongoDBVector` for collections you bring yourself (`collectionName`).

- `deleteIndex()` drops only the search indexes and collections Mastra created. Indexes that already existed, or that earlier versions registered, are kept. A name with no registration now throws `NOT_REGISTERED` instead of dropping a collection.
- Added `claimLegacyIndex({ indexName })` for managed indexes Mastra can't prove it created: collections made before `@mastra/mongodb@1.15.0`, and 1.15 through 1.27 indexes without ownership records. Claim one only if you want `deleteIndex()` to drop its collection and all its data later, or want to change its text mappings. The claim itself drops nothing.

```typescript
// Without a claim, deleteIndex() throws NOT_REGISTERED or OWNERSHIP_UNKNOWN.
await store.claimLegacyIndex({ indexName: 'movies' });
await store.deleteIndex({ indexName: 'movies' }); // now drops the collection
```

- `deleteIndex()` also throws `IN_USE` while another registration uses the managed collection, `INDEX_DELETING` after a half-finished delete (retry), and `CAPABILITY_CHECK_FAILED` or `OUTCOME_UNKNOWN` when transactions can't confirm the result (retry). Concurrent deletes of indexes sharing a collection are only coordinated on Atlas, Atlas Local and replica sets, not standalone servers.
- A search index that another registration still uses is kept when a logical index is deleted, and the last registration drops it. A text index replaced by a rename is dropped when the logical index is deleted.
- `allowWrites` is deprecated and `createIndex({ allowWrites: true })` logs a warning. It still works in this release. Write embeddings into bring-your-own documents from your application, or use `autoEmbed`.
- `createSearchIndex()` reuses an existing full-text index Mastra didn't create when its whole definition is equivalent (field types, analyzers, nested fields, `storedSource` and synonyms), and throws a `CONFLICT` error otherwise. It never rewrites that index.
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
