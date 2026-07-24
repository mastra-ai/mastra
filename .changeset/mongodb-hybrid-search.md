---
'@mastra/mongodb': minor
---

MongoDBVector now supports full-text and hybrid retrieval. `createSearchIndex` provisions an Atlas Search index, `textQuery` runs a BM25 search, and `hybridQuery` fuses vector + text results server-side with $rankFusion (requires MongoDB 8.0+; on 8.0.x it may need a MongoDB support case to enable).

A custom or field-restricted text-search index name is now persisted and resolved automatically by `textQuery`/`hybridQuery` (with a per-call override), so a `searchIndexName` passed to `createSearchIndex` is reachable; when `fields` is supplied without an explicit name, the field-mapped index is created under a distinct name so its mapping is not shadowed by the auto-created dynamic index. `hybridQuery`'s vector branch now reuses the same pushdown-vs-fallback filter logic as `query`, so metadata filters on undeclared fields no longer hard-error on bring-your-own collections.

Hardening for bring-your-own (BYO) operational collections:

- Full-text/hybrid search on a BYO collection is now **opt-in**: `createIndex` no longer auto-creates a billable dynamic full-text index on a caller-owned collection. Call `createSearchIndex` to enable `textQuery`/`hybridQuery` (which otherwise throw a clear error); managed collections keep auto-creating it for back-compat.
- `deleteIndex` on a BYO index now also drops the companion full-text search index (when one was provisioned), not just the vector index, so it no longer leaks an untracked index onto the caller's collection. The collection and its documents are still preserved.
- `createIndex` now throws a clear error when a logical index is retargeted to a different collection than the one already registered, instead of silently orphaning the previous collection's index; idempotent re-creation against the same collection still succeeds.
- `metadataMode: 'document'` now omits the (large) embedding field from `metadata` by default; set `includeVector: true` to retain it and also expose it as a top-level `vector`. A real source field named `score` is still preserved.
- BYO operational collections with native **`ObjectId` `_id`s** are now fully supported: query results coerce `_id` to a string (the `QueryResult.id` contract), and `deleteVector`/`updateVector`/`deleteVectors` accept that string and match the underlying `ObjectId` document. Managed (string `_id`) collections are unaffected.
- In `metadataMode: 'document'`, metadata filters now operate on **root document fields** instead of being rewritten to `metadata.<field>`, so filters like `{ lane: 'fraud' }` match a BYO collection's top-level operational fields (both the pushdown and `$match` fallback paths). Managed `'field'` mode keeps the `metadata.` rewriting.
- The full-text search index builds asynchronously; a new `waitForSearchIndexReady()` (and a `waitUntilReady` option on `createSearchIndex`) blocks until the text index reports READY, so an immediate `textQuery`/`hybridQuery` no longer intermittently fails. The field-mapped default text-index name is now unique per logical index so two logical indexes on one collection no longer collide.
- `hybridQuery` floors its vector-branch `numCandidates` at the branch limit, so `numCandidates` smaller than the internal limit no longer triggers a server-side error. `describeIndex().count` now counts only documents that actually carry the embedding field (relevant on BYO collections with a mix of embedded and non-embedded documents).
- The `$rankFusion` support probe (`buildInfo`) is memoized per instance, and `textQuery` guards its score consistently with `hybridQuery`.

**Example**
```ts
await store.createSearchIndex({ indexName: 'precedents', fields: ['note'] });
const hits = await store.hybridQuery({ indexName: 'precedents', queryVector, query: 'shell company', paths: ['note'], topK: 10 });
```
