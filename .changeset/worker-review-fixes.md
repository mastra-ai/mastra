---
'@mastra/core': minor
'mastra': minor
'@mastra/server': minor
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
- `RedisStreamsPubSub.maxDeliveryAttempts` now rejects negative / NaN values
  at construction. `0` still means "no cap" for back-compat but emits a
  one-time warning; pass `Infinity` to disable the cap explicitly.
- `PullTransport` accepts a logger and uses it for unhandled router-callback
  rejections instead of `console.error`.
- `BackgroundTaskWorker.start()` now throws if `init()` was not called,
  matching the contract of the other workers.
- Cross-process integration tests now spawn a single user-owned project
  (`test-fixtures/cli-project/src/mastra/index.ts`) through two generic
  entries that mirror what `BuildBundler` and `WorkerBundler` emit. The
  previous one-off `server.entry.ts` / `worker.entry.ts` /
  `scheduler.entry.ts` / `background.entry.ts` files have been deleted —
  they implied users hand-roll entry files, which they don't. Worker role
  is selected via `MASTRA_WORKERS` exactly as in production.

Push-capable PubSub:

- The `PubSub` abstract class now declares a `supportedModes` getter
  (defaulting to `['pull']` for backward compatibility) so consumers can
  tell whether a broker delivers events through a pull loop, an in-process
  push, or an out-of-process HTTP push. `EventEmitterPubSub` reports
  `['pull', 'push']` (EventEmitter dispatches synchronously and works for
  either path), `@mastra/redis-streams` reports `['pull']`.
- `Mastra` now exposes a public `handleWorkflowEvent(event)` method backed
  by a shared `WorkflowEventProcessor`. It is the single entry point used
  by the existing pull-mode `OrchestrationWorker`, by in-process push
  pubsubs (auto-wired during `startWorkers()`), and by the new
  `POST /api/workflows/events` route which lets push-mode brokers (GCP
  Pub/Sub push, SNS, EventBridge) deliver events over HTTP.
- When the configured pubsub does not support `'pull'`, Mastra
  automatically skips creating an `OrchestrationWorker` and
  `OrchestrationWorker.init()` throws a clear error if it is constructed
  against a push-only pubsub.
- `WorkflowEventProcessor` gains a `handle(event)` method that returns a
  structured `{ ok, retry }` result. The original `process(event, ack?)`
  method is preserved as a thin wrapper for back-compat.

Public-API example for a push-capable PubSub:

```ts
import { Mastra } from '@mastra/core/mastra';
import { EventEmitterPubSub } from '@mastra/core/pubsub';

const mastra = new Mastra({
  // A push-capable broker (GCP Pub/Sub push, SNS, EventEmitter, …).
  // EventEmitterPubSub reports supportedModes = ['pull', 'push'].
  pubsub: new EventEmitterPubSub(),
  workflows: { myWorkflow },
});

// In-process push pubsubs are auto-wired here. For out-of-process
// push (e.g. HTTP webhook from a cloud broker), POST the event to
// /api/workflows/events on your Mastra server instead.
await mastra.startWorkers();

// Direct invocation (e.g. inside an HTTP handler that bridges from a
// cloud broker's push delivery):
await mastra.handleWorkflowEvent({
  id: 'evt-1',
  type: 'workflow.start',
  runId: 'run-1',
  createdAt: new Date(),
  data: { workflowId: 'myWorkflow', inputData: { name: 'world' } },
});
```

CI follow-ups:

- `Mastra` only auto-registers `SchedulerWorker` when storage is configured.
  Without storage the worker would crash on startup (`deps.storage.getStore`
  on undefined); the scheduler now silently no-ops in that case, matching the
  pre-worker scheduler behavior.
- `SchedulerWorker.init` defensively logs and returns when called without
  storage instead of throwing a TypeError.
- `RECEIVE_WORKFLOW_EVENT_ROUTE` (`POST /workflows/events`) `createdAt` is
  now a plain `z.string()` on the wire and the handler converts it to a
  `Date` (validating "Invalid Date" -> 400). The previous
  `union(...).transform().refine()` schema couldn't be exercised by the
  shared adapter test suite because the generator didn't unwrap Zod 4's
  `ZodPipe`.
- `_test-utils/route-test-utils` recognizes Zod 4's `number_format` check
  (used for `int()` / `safeint()`), and `generateContextualValue` now
  produces a valid ISO timestamp for `createdAt` / `updatedAt` fields.
