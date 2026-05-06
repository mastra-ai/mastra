---
'@mastra/core': minor
'mastra': patch
'@mastra/server': patch
'@mastra/redis-streams': patch
---

Worker review fixes:

- Add `MASTRA_WORKER_SECRET` worker-token auth on the workflow step-execution
  endpoint. When configured on the server, requests to
  `/workflows/:id/runs/:runId/steps/execute` must include a matching
  `workerToken` in the body or the server returns 401. `HttpRemoteStrategy`
  picks the secret up from `process.env.MASTRA_WORKER_SECRET`.
- Honor the caller's `abortSignal` in `HttpRemoteStrategy` by combining it
  with the per-request timeout via `AbortSignal.any` (with a manual
  fallback for runtimes that don't expose it).
- Implement comma-separated name filtering for the `MASTRA_WORKERS` env
  var. `MASTRA_WORKERS=scheduler,backgroundTasks` now boots only those
  named workers; `MASTRA_WORKERS=false` still disables all workers.
- Restore `Mastra.startEventEngine` / `stopEventEngine` as `@deprecated`
  aliases for the renamed `startWorkers` / `stopWorkers`.
- `BackgroundTaskWorker` now subscribes to PubSub in `start()` instead of
  `init()`, matching the lifecycle of the other workers and making
  `isRunning` accurately reflect subscription state.
- `RedisStreamsPubSub` adds a `maxDeliveryAttempts` option (default 5)
  that drops events after the configured number of failed deliveries
  instead of redelivering forever, and replaces empty `catch {}` blocks
  with `logger.warn`/`logger.debug` calls.
- `RedisStreamsPubSub.unsubscribe(topic, cb)` now honors the topic
  argument so the same callback can be subscribed to multiple topics
  independently.
- `PullTransport` guards the async router callback against unhandled
  promise rejections by attaching a `.catch` that nacks the message.
- Drop the dead `MASTRA_WORKER_NAME` env var injection in the CLI worker
  spawn (the bundle entrypoint already passes the worker name directly).
- Internal type cleanups (drop several `as any` casts in worker
  strategies and `BackgroundTaskWorker`).
