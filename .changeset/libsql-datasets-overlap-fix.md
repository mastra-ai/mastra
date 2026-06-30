---
'@mastra/libsql': patch
---

Fixed a double-encoding bug where `createDataset` stored `targetIds` and `scorerIds` as JSON-encoded strings instead of arrays. This caused the new `listDatasets({ filters: { targetIds } })` overlap query to never match. Existing rows written before this fix may still be in the wrong shape and need to be rewritten via `updateDataset` for the new filter to find them.
