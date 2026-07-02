---
'@mastra/core': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Pushed remaining dataset read filters and pagination down to storage.

`DatasetsManager.list({ filters })` now accepts `targetType`, `targetIds` (overlap/union semantics), and `name` (substring, case-insensitive) in addition to the existing tenancy and candidate filters. Filtering is pushed down to the storage layer so callers no longer have to post-filter results.

Storage adapters must also be upgraded to the versions listed below to honor the new filters. If a caller is on this version of `@mastra/core` but on an older storage adapter, the new `targetType`/`targetIds`/`name` filter keys are silently ignored by the adapter — no runtime error, but the filter has no effect and every dataset in the tenancy is returned.

`Dataset.listItems({ version, search, page, perPage })` now applies `search` and pagination at the storage layer when `version` is provided alongside any of those. Previously they were silently dropped whenever `version` was set. The return shape is unchanged: passing only `version` still returns a bare `DatasetItem[]` snapshot; passing `search`, `page`, or `perPage` (with or without `version`) returns the paginated `{ items, pagination }` shape. The bare-array branch is marked `@deprecated`; prefer passing `page` / `perPage` to always receive the paginated shape.
