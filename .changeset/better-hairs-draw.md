---
'@mastra/server': minor
---

Added `durable`, `itemTimeout` and `maxRetries` to the experiment trigger route (`POST /datasets/:datasetId/experiments`), so a server can start an experiment that keeps running after the process that started it stops.

```bash
curl -X POST http://localhost:4111/api/datasets/$DATASET_ID/experiments \
  -H 'content-type: application/json' \
  -d '{"targetType":"agent","targetId":"support-agent","durable":true,"itemTimeout":30000,"maxRetries":1}'
```

A durable start answers `pending` with `startedAt: null`. A config a durable run can't store now returns 400 instead of 500, and with an older `@mastra/core` that has no durable experiments, `durable: true` returns 400 instead of silently running the experiment in process.

`POST /workflows/events` now returns 404 for an event that names an experiment run that was never started, so a forged event can't re-run an existing experiment.
