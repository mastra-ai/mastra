---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added HTTP endpoints for external experiments: `POST /datasets/:datasetId/experiments` now accepts `targetType: "external"` (no runner is spawned), and new routes `POST /datasets/:datasetId/experiments/:experimentId/results` and `POST /datasets/:datasetId/experiments/:experimentId/finalize` let external workers submit per-item results (idempotent upsert on retries) and finalize the run with server-computed counts.
