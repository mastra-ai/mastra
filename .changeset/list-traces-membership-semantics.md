---
'@mastra/core': patch
'@mastra/duckdb': patch
'@mastra/clickhouse': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Change `listTraces` filter semantics so that per-span attributes (`entityType`, `entityId`, `entityName`, `userId`, `organizationId`, `resourceId`, `runId`, `sessionId`, `threadId`, `requestId`, `environment`, `serviceName`, `experimentId`, `tags`) resolve against **any** span in the trace, not only the root span. A trace with root `WORKFLOW_RUN` and a nested `AGENT` span named `Observer` now surfaces when filtering by `entityName=Observer`, which matches what the Metrics view already shows and what discovery endpoints (`getEntityNames`) advertise as selectable.

Root-level predicates — `traceId`, `rootEntityType/Id/Name`, `source`, `startedAt`, `endedAt`, `status`, `hasChildError`, `scope`, `metadata` — continue to apply to the root span only.

Each backend resolves membership via a single `EXISTS` subquery against the same spans source, narrowed to the outer query's date window to keep scans bounded.
