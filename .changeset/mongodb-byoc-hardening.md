---
'@mastra/mongodb': minor
---

Hardened `MongoDBVector` for collections you bring yourself (`collectionName`).

- `deleteIndex()` drops only the search indexes and collections Mastra created. Managed collections are now created with `validationLevel: 'off'` (no effect without a validator), so a collection another client creates at the same moment with other options is adopted, not recorded as Mastra's. Indexes that already existed are kept, and indexes that earlier versions registered aren't dropped without a claim (`claimLegacyIndex()`). A name with no registration now throws `NOT_REGISTERED` instead of dropping a collection.
- Added `claimLegacyIndex({ indexName })` for managed indexes Mastra can't prove it created: collections made before `@mastra/mongodb@1.15.0`, and 1.15 through 1.27 indexes without ownership records. Claim one only if you want `deleteIndex()` to drop its collection and all its data later, or want to change its text mappings. The claim itself drops nothing.

```typescript
// Without a claim, deleteIndex() throws NOT_REGISTERED or OWNERSHIP_UNKNOWN.
await store.claimLegacyIndex({ indexName: 'movies' });
await store.deleteIndex({ indexName: 'movies' }); // now drops the collection
```

- `deleteIndex()` also throws `IN_USE` while another registration uses the managed collection, `CAPABILITY_CHECK_FAILED` or `OUTCOME_UNKNOWN` when transactions can't confirm the result (retry). `createIndex()`, `createSearchIndex()` and `claimLegacyIndex()` throw `INDEX_DELETING` while a delete is half-finished, and retrying `deleteIndex()` finishes it. Concurrent deletes of indexes sharing a collection are only coordinated on Atlas, Atlas Local and replica sets, not standalone servers.
- Two concurrent `createIndex()` calls for the same new name both succeed when they ask for the same collection and embedding. If they ask for different ones, the later call throws `CONFLICT` naming what differs, instead of silently overwriting the first registration.
- A search index that another registration still uses is kept when a logical index is deleted, and the last registration drops it. A text index replaced by a rename is dropped when the logical index is deleted.
- A `createIndex()` or `createSearchIndex()` call that starts using a search index a running `deleteIndex()` is about to drop throws `INDEX_DELETING`. Retrying once the delete finishes is safe. A call throws `CONFLICT` and provisions nothing when, before its last check ahead of provisioning, its registration is removed or another call changes its collection or the names of the search indexes it is about to create. A `createSearchIndex()` call also throws `CONFLICT` when its registration changed after it was read, and so does a `createIndex()` on an existing registration that was deleted or recreated meanwhile (a registration created by an earlier version is re-read once instead, and the call proceeds against the current registration). A `deleteIndex()` of such a registration throws a retryable `CONFLICT` and drops nothing when another call writes to it meanwhile. A `deleteIndex()` that overlaps another delete and a re-create leaves the new registration alone. A re-created managed collection has one exception, listed under [cleanup limits](https://mastra.ai/integrations/vectors/mongodb#cleanup-limits).
- Mastra records the Atlas ID of every search index it creates and drops or updates search indexes only by that ID, so a recorded index isn't confused with one recreated under the same name (exceptions are listed under [cleanup limits](https://mastra.ai/integrations/vectors/mongodb#cleanup-limits)). A search index Mastra created now stays recorded when its registration changes during the call, or when a delete and a re-create overlap: the call throws `CONFLICT`, and `deleteIndex()` later drops the index or another registration takes it over. Identical concurrent calls both succeed. Work a crashed process left behind is finished by the next call on that collection after 5 minutes.
- Changing an index's vector `searchIndexName` with `createIndex()` keeps cleanup responsibility for the old vector index Mastra created, and `deleteIndex()` drops it.
- New `CONFLICT`, `INDEX_DELETING` and `FAILED` messages and new `warn` and `error` logs explain these cases. When cleanup after a failed or interrupted create can't drop an index Mastra created, the drop is retried, and logged again, on each later `createIndex()`, `createSearchIndex()`, `deleteIndex()` or `claimLegacyIndex()` on that collection. A drop that fails inside `deleteIndex()` itself leaves the registration being deleted: retry `deleteIndex()` to finish it. See [cleanup errors and logs](https://mastra.ai/integrations/vectors/mongodb#cleanup-errors-and-logs), which includes how to clear a search index stuck in `DELETING` or `DOES_NOT_EXIST` (common on Atlas Local after dropping a collection that still had search indexes).
- On an Atlas cluster, a search index another client creates with the same name and definition just before Mastra's create is recorded as Mastra's and dropped by `deleteIndex()`. In practice only another Mastra process produces that definition.
- Upgrade every instance before relying on these cleanup guarantees. Older instances drop search indexes by name.
- Mastra's index records are always read and written on the primary with `majority` concerns, whatever the client options. This adds latency, and these writes wait while a majority of the replica set is unavailable.
- `allowWrites` is deprecated and `createIndex({ allowWrites: true })` logs a warning. It still works in this release. Write embeddings into bring-your-own documents from your application, or use `autoEmbed`.
- `createSearchIndex()` reuses an existing full-text index Mastra didn't create when its whole definition is equivalent (field types, analyzers, nested fields, `storedSource` and synonyms), and throws a `CONFLICT` error otherwise. It never rewrites that index.
- `createSearchIndex({ fields })` now indexes nested paths such as `metadata.name`. Previously Atlas Search read them as literal field names, so `textQuery()` and `hybridQuery()` matched nothing.
- If `createIndex()` or `createSearchIndex()` fails before creating its search index, only the registration fields that call wrote are restored, or the registration it inserted is removed. A search index Mastra created is never undone: if the companion full-text index fails after the vector index was created, `createIndex()` throws and keeps the vector index.
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
