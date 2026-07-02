---
'@mastra/core': minor
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Pushed remaining dataset read filters and pagination down to storage.

`DatasetsManager.list({ filters })` now accepts `targetType`, `targetIds` (overlap/union semantics), and `name` (substring, case-insensitive) in addition to the existing tenancy and candidate filters. Filtering is pushed down to the storage layer so callers no longer have to post-filter results.

Storage adapters must also be upgraded to the versions listed below to honor the new filters. If a caller is on this version of `@mastra/core` but on an older storage adapter, the new `targetType`/`targetIds`/`name` filter keys are silently ignored by the adapter — no runtime error, but the filter has no effect and every dataset in the tenancy is returned.

`Dataset.listItems({ version, search, page, perPage })` now applies `search` and pagination at the storage layer when `version` is set. Previously these were silently dropped whenever `version` was provided.

**Breaking change on `Dataset.listItems` return type.** The return type is narrowed from `DatasetItem[] | { items, pagination }` to always `{ items, pagination }`. Previously, passing `version` returned a bare `DatasetItem[]` via `store.getItemsByVersion`; that branch is gone so `search` and pagination can reach the storage layer alongside `version`. Callers that were narrowing on the array branch — including anything doing `Array.isArray(result)`, `result.length`, or `result.map(...)` on the return value — must switch to reading `result.items`.

```ts
// Before — when `version` was provided, the result was a bare DatasetItem[]
const items = await dataset.listItems({ version: someVersion });
items.forEach(item => /* ... */);

// After — the result is always `{ items, pagination }`
const { items } = await dataset.listItems({ version: someVersion });
items.forEach(item => /* ... */);
```
