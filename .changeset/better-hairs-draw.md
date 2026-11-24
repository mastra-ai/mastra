---
'@mastra/server': minor
'mastra': patch
---

Added `durable`, `itemTimeout` and `maxRetries` to the experiment trigger route (`POST /datasets/:datasetId/experiments`), so a server can start an experiment as a durable evented workflow. A durable start returns `pending` with `startedAt: null`. A config that a durable run cannot store now returns 400 instead of 500. With an older `@mastra/core` that has no durable experiments, `durable: true` returns 400 instead of silently running the experiment in-process.
