---
'@mastra/core': minor
'mastra': patch
'@mastra/server': patch
'@mastra/redis-streams': patch
---

Worker review fixes:

- Step-execution endpoint (`POST /workflows/:id/runs/:runId/steps/execute`) is
  now gated by Mastra's standard `requiresAuth: true` + `authenticateToken`
  pipeline rather than a parallel "worker secret" body field. The previously
  introduced `workerSecret` config knob and `MASTRA_WORKER_SECRET` env var
  have been removed (they were never released). To gate the endpoint on a
  standalone-worker deployment, configure an auth provider on the server's
  `Mastra` instance — without one the framework currently treats
  `requiresAuth: true` as a no-op for this route.
- `HttpRemoteStrategy` now sends credentials as a normal `Authorization:
  Bearer <token>` header. The token comes from the new
  `MASTRA_WORKER_AUTH_TOKEN` env var or an explicit `auth` constructor option.
- Honor the caller's `abortSignal` in `HttpRemoteStrategy` by combining it
  with the per-request timeout via `AbortSignal.any` (with a manual fallback
  for runtimes that don't expose it).
- Implement comma-separated name filtering for the `MASTRA_WORKERS` env var.
  `MASTRA_WORKERS=scheduler,backgroundTasks` now boots only those named
  workers; `MASTRA_WORKERS=false` still disables all workers.
- Restore `Mastra.startEventEngine` / `stopEventEngine` as `@deprecated`
  aliases for the renamed `startWorkers` / `stopWorkers`.
- `BackgroundTaskWorker` now subscribes to PubSub in `start()` instead of
  `init()`, matching the lifecycle of the other workers and making
  `isRunning` accurately reflect subscription state.
- `RedisStreamsPubSub` adds a `maxDeliveryAttempts` option (default 5) that
  drops events after the configured number of failed deliveries instead of
  redelivering forever, and replaces empty `catch {}` blocks with
  `logger.warn`/`logger.debug` calls.
- `RedisStreamsPubSub.unsubscribe(topic, cb)` now honors the topic argument
  so the same callback can be subscribed to multiple topics independently.
- `PullTransport` guards the async router callback against unhandled promise
  rejections by attaching a `.catch` that nacks the message.
- Drop the dead `MASTRA_WORKER_NAME` env var injection in the CLI worker
  spawn (the bundle entrypoint already passes the worker name directly).
- Add a real cross-process e2e auth suite
  (`pubsub/redis-streams/src/auth-e2e.test.ts`) covering happy path, wrong
  token, missing token, anonymous direct hits, and the no-auth-provider
  pin-down behavior.
- Step-execution route now has a response schema, satisfying
  `schema-consistency.test.ts`.
- Internal type cleanups (drop several `as any` casts in worker strategies
  and `BackgroundTaskWorker`).
