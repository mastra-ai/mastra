---
'@mastra/libsql': patch
---

Fixed a double-encoding bug where `createDataset` stored `targetIds` and `scorerIds` as JSON-encoded strings instead of arrays. This caused the new `listDatasets({ filters: { targetIds } })` overlap query to never match.

Existing rows written before this fix are still double-encoded and will not be matched by the new `targetIds` filter. They self-heal on the next `updateDataset` call. Deployments with a long tail of pre-existing datasets should run a one-time backfill (re-encoding `targetIds` and `scorerIds` on affected rows) rather than rely on incidental writes; this can be tracked as a follow-up if needed.
