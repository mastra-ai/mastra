---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
---

Datasets: re-inherit tenancy on item update/delete from the parent dataset instead of from the prior item row, so tombstones and updates can't carry stale `organizationId`/`resourceId`. Also drop tenancy/candidate identity from `UpdateDatasetInput` — those fields are immutable after creation and were silently ignored by most adapters.
