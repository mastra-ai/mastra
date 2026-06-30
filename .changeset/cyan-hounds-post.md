---
'@mastra/core': minor
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added server-side filters and pagination to dataset read APIs.

`DatasetsManager.list({ filters })` now accepts `targetType`, `targetIds` (overlap/union semantics), and `name` (substring, case-insensitive) in addition to the existing tenancy and candidate filters. Filtering is pushed down to the storage layer so callers no longer have to post-filter results.

`Dataset.listItems({ version, search, page, perPage })` now applies `search` and pagination at the storage layer when `version` is set. Previously these were silently dropped whenever `version` was provided. The return type is narrowed to always be `{ items, pagination }`.

**Breaking change:** `Dataset.listItems` no longer returns the bare `DatasetItem[]` shape. Update callers to read from `result.items`:

```ts
// Before
const items = await dataset.listItems({ version: 3 });
for (const item of items) {
  /* ... */
}

// After
const { items, pagination } = await dataset.listItems({ version: 3, search: 'foo', page: 0, perPage: 50 });
```
