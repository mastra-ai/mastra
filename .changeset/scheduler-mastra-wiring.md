---
'@mastra/core': minor
---

Wired the `WorkflowScheduler` into the `Mastra` lifecycle. Evented workflows that declare a `schedule` now fire on cron automatically — no opt-in required.

**What's new:**

- `Mastra` accepts a new optional `scheduler: WorkflowSchedulerConfig` for tuning the tick loop (`tickIntervalMs`, `batchSize`), forcing the scheduler on (`enabled: true`) when only imperative schedules are used, and supplying an `onError` callback.
- The scheduler is auto-instantiated when any registered workflow declares a `schedule` config or when `scheduler.enabled` is `true`. It is **not** instantiated otherwise.
- Declarative schedules from workflow configs are registered at boot under stable ids of the form `wf_${workflowId}` so re-registration is idempotent across restarts.
- Imperative API exposed via `mastra.scheduler` — call `create`, `pause`, `resume`, `delete`, `list`, `get`, and `listTriggers` to manage schedules at runtime.
- `mastra.shutdown()` now stops the scheduler before tearing down the event engine and observability.

**Engine routing rule:**

`mastra.addWorkflow()` now throws a `MastraError` (`MASTRA_WORKFLOW_SCHEDULE_REQUIRES_EVENTED_ENGINE`) when a workflow declares a `schedule` but is not using the evented engine. Import `createWorkflow` from `@mastra/core/workflows/evented` for scheduled workflows.

**Storage requirement:**

The scheduler requires a storage adapter implementing the `schedules` domain. `@mastra/libsql` is supported today; additional adapters will follow. If the storage adapter does not provide the `schedules` domain at boot time, scheduler initialization fails with `MASTRA_SCHEDULER_STORAGE_NOT_AVAILABLE`.
