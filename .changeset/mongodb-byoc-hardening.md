---
'@mastra/mongodb': minor
---

Hardened `MongoDBVector` for collections you bring yourself (`collectionName`).

- `deleteIndex()` drops only the search indexes and collections Mastra created. Indexes that already existed are kept, and indexes that earlier versions registered aren't dropped without a claim (`claimLegacyIndex()`). A name with no registration now throws `NOT_REGISTERED` instead of dropping a collection.
- Added `claimLegacyIndex({ indexName })` for managed indexes Mastra can't prove it created: collections made before `@mastra/mongodb@1.15.0`, and 1.15 through 1.27 indexes without ownership records. Claim one only if you want `deleteIndex()` to drop its collection and all its data later, or want to change its text mappings. The claim itself drops nothing.

```typescript
// Without a claim, deleteIndex() throws NOT_REGISTERED or OWNERSHIP_UNKNOWN.
await store.claimLegacyIndex({ indexName: 'movies' });
await store.deleteIndex({ indexName: 'movies' }); // now drops the collection
```

- `deleteIndex()` also throws `IN_USE` while another registration uses the managed collection, `CAPABILITY_CHECK_FAILED` or `OUTCOME_UNKNOWN` when transactions can't confirm the result (retry). `createIndex()`, `createSearchIndex()` and `claimLegacyIndex()` throw `INDEX_DELETING` while a delete is half-finished, and retrying `deleteIndex()` finishes it. Concurrent deletes of indexes sharing a collection are only coordinated on Atlas, Atlas Local and replica sets, not standalone servers.
- Two concurrent `createIndex()` calls for the same new name both succeed when they ask for the same collection and embedding. If they ask for different ones, the later call throws `CONFLICT` naming what differs, instead of silently overwriting the first registration.
- A search index that another registration still uses is kept when a logical index is deleted, and the last registration drops it. A text index replaced by a rename is dropped when the logical index is deleted.
- A `createIndex()` or `createSearchIndex()` call that starts using a search index a running `deleteIndex()` is about to drop throws `INDEX_DELETING`. Retrying once the delete finishes is safe. A call throws `CONFLICT` and provisions nothing when, before its last check ahead of provisioning, its registration is removed or another call changes its collection or the names of the search indexes it is about to create. A `createSearchIndex()` call also throws `CONFLICT` when its registration changed after it was read.
- Mastra records the Atlas ID of every search index it creates and drops or updates search indexes only by ID, so it never drops an index someone else recreated under the same name. A search index Mastra created now stays recorded when its registration changes during the call or a delete and an identical re-create overlap: it's kept for `deleteIndex()` to drop, handed to the registration that now uses the name, or dropped. The call throws `CONFLICT` with one of these messages: `Index "<indexName>" was removed or recreated by another call while this one ran, so nothing was provisioned. Retry.`, `the target changed concurrently; the index this call created is kept as a retired index of the registration and removed by deleteIndex`, or `the registration was removed or recreated while this call ran; what it created was handed over or removed`. Identical concurrent calls both succeed and record the index once. Work left by a crashed process is finished by the next call on that collection after 5 minutes.
- Changing an index's vector `searchIndexName` with `createIndex()` keeps cleanup responsibility for the old vector index Mastra created, and `deleteIndex()` drops it.
- `createIndex()` and `createSearchIndex()` throw `CONFLICT` (`search index "<name>" on "<collection>" is in status <status> (id <id>); the previous index under this name is still being removed. Retry. If it persists, drop it manually.`) while Atlas still lists an earlier index under the name as `DELETING` or `DOES_NOT_EXIST`. On Atlas Local, a collection dropped with its search indexes can leave such rows behind, and retrying doesn't help: drop the row by ID with `db.runCommand({ dropSearchIndex: '<collection>', id: '<id>' })`, and drop search indexes before dropping such a collection.
- `INDEX_DELETING` now also covers a pending removal of an index Mastra created: `search index "<name>" on "<collection>" is pending removal of an index Mastra created (cleanup record <_id>). Retry: retrying runs the cleanup. If the drop keeps failing, the block remains and the failure is logged at error level.` A create whose outcome can't be confirmed throws `FAILED` (`The create of search index "<name>" on "<collection>" may or may not have reached Atlas. Retry.`), and `claimLegacyIndex()` throws `CONFLICT` (`index changed while it was being claimed; nothing was claimed; retry`) when a search index changes during the claim.
- New logs: a `warn` (`search index "<name>" on "<collection>" (id <id>) may have been created by Mastra; kept; drop it manually if unused`) when Mastra can't confirm it created an index, which it then keeps; a `warn` when an index Atlas returned is more than 30 seconds older than Mastra's create and is treated as someone else's; and an `error` when dropping an index Mastra created fails. That drop is retried, and the `error` logged again, on each later `createIndex()` or `createSearchIndex()` on that collection.
- On an Atlas cluster, an index another client creates with the same name and a byte-identical definition within about one round trip before Mastra's create is recorded as Mastra's and dropped by `deleteIndex()`. In practice only another Mastra process produces that definition, and an index another registration uses is never dropped.
- Upgrade every instance before relying on these cleanup guarantees: older instances drop search indexes by name and ignore the new provisioning journal.
- The registry and the new internal `__mastra_vector_ops__` journal are always read and written on the primary with `majority` read and write concerns, whatever the client options. This adds latency, and these writes wait while a majority of the replica set is unavailable (for example, a primary-secondary-arbiter replica set with its secondary down).
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
