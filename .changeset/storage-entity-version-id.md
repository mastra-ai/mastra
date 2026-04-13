---
'@mastra/duckdb': patch
'@mastra/clickhouse': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
---

Added `entityVersionId` column to observability storage tables (spans, metrics, scores, feedback, logs) for filtering and grouping traces by entity version. Added `targetType`, `targetId`, `agentVersion`, and `status` filters to `listExperiments`, and `traceId` and `status` filters to `listExperimentResults`.
