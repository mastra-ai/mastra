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

`Dataset.listItems({ version, search, page, perPage })` now applies `search` and pagination at the storage layer when `version` is set. Previously these were silently dropped whenever `version` was provided.

The declared return type of `Dataset.listItems` is unchanged (`DatasetItem[] | { items, pagination }`), but the runtime now always returns the `{ items, pagination }` branch. Callers that were narrowing on the `DatasetItem[]` branch should switch to reading `result.items`; the bare-array branch is no longer produced.
