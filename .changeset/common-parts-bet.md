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

Added HTTP endpoints for caller-driven experiments: `POST /datasets/:datasetId/experiments` now accepts `start: false` to create an experiment without spawning the runner (with an optional target and run-level `scorerIds`), and new routes `POST /datasets/:datasetId/experiments/:experimentId/items/:itemId/run`, `POST /datasets/:datasetId/experiments/:experimentId/results`, and `POST /datasets/:datasetId/experiments/:experimentId/finalize` let external orchestrators run one item server-side, submit externally computed per-item results (idempotent upsert on retries), and finalize the run with server-computed counts.
