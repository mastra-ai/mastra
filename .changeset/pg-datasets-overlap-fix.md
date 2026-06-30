---
'@mastra/pg': patch
---

Fixed a double-encoding bug where `createDataset` and `updateDataset` stored `targetIds` and `scorerIds` as JSON-encoded strings into the `JSONB` columns instead of arrays. This caused the new `listDatasets({ filters: { targetIds } })` overlap query (`targetIds ?| array[...]`) to never match. Existing rows written before this fix may still be in the wrong shape and need to be rewritten via `updateDataset` for the new filter to find them.
