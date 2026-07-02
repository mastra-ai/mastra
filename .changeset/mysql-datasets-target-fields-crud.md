---
'@mastra/mysql': patch
---

Filled a pre-existing CRUD gap so the new dataset filter API works end-to-end on MySQL.

`createDataset`, `updateDataset`, and `mapDataset` now persist and hydrate `targetType`, `targetIds`, `scorerIds`, `tags`, and `requestContextSchema`. The columns were already declared by the shared schema but were never written or read, so `listDatasets({ filters: { targetType, targetIds, name } })` would have matched nothing on MySQL before this fix. `alterTable.ifNotExists` was widened so in-place upgrades pick up the columns for older databases.

Also fixed a `mapItem` row deserialization bug: when the stored input/groundTruth/metadata was a JSON string scalar, the mysql2 driver auto-parses the JSON column to a JS string and the previous `parseJSON` helper then tried to `JSON.parse` it again and silently returned `undefined`. It now falls back to the raw string when re-parsing fails, so versioned `listItems({ search })` results round-trip the original input.
