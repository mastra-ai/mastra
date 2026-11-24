---
'@mastra/server': minor
---

Added `durable`, `itemTimeout` and `maxRetries` to the experiment trigger route (`POST /datasets/:datasetId/experiments`), so a server can start an experiment that keeps running after the process that started it stops.

```bash
curl -X POST http://localhost:4111/api/datasets/$DATASET_ID/experiments \
  -H 'content-type: application/json' \
  -d '{"targetType":"agent","targetId":"support-agent","durable":true,"itemTimeout":30000,"maxRetries":1}'
```

A durable start answers `pending` with `startedAt: null`. `maxConcurrency` must now be a positive integer; other values return 400. A config a durable run can't store now returns 400 instead of 500, and with an older `@mastra/core` that has no durable experiments, `durable: true` returns 400 instead of silently running the experiment in process.

`POST /workflows/events` only accepts the events an experiment run sends (start, step, end, fail and cancel) for a run Mastra started, carrying that run's stored input. It returns 404 when the run doesn't exist and 400 for a resume, suspend or time travel, or when the event names another run, dataset, experiment or request context, so a forged event can't run someone else's experiment.
