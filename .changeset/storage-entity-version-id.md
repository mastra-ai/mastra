---
'@mastra/duckdb': patch
'@mastra/clickhouse': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
---

Added `entityVersionId`, `parentEntityVersionId`, and `rootEntityVersionId` columns to observability storage tables (spans, metrics, scores, feedback, logs) for filtering and grouping traces by entity version. Added ALTER TABLE migrations for existing databases. Added `targetType`, `targetId`, `agentVersion`, and `status` filters to `listExperiments`, and `traceId` and `status` filters to `listExperimentResults`.
