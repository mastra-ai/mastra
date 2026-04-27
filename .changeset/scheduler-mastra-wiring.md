---
'@mastra/core': minor
---

Wired the `WorkflowScheduler` into the `Mastra` lifecycle. Evented workflows that declare a `schedule` now fire on cron automatically — no opt-in required.

**What's new:**

- `Mastra` accepts a new optional `scheduler: WorkflowSchedulerConfig` for tuning the tick loop (`tickIntervalMs`, `batchSize`), forcing the scheduler on (`enabled: true`), and supplying an `onError` callback.
- The scheduler is auto-instantiated when any registered workflow declares a `schedule` config or when `scheduler.enabled` is `true`. It is **not** instantiated otherwise — projects without scheduled workflows pay zero cost.
- Declarative schedules from workflow configs are registered at boot under stable ids of the form `wf_${workflowId}` (single-schedule form) or `wf_${workflowId}__${scheduleId}` (array form) so re-registration is idempotent across restarts. If the workflow's schedule config changes (cron, timezone, target payload, or metadata), the existing row is patched in place; cron or timezone changes also recompute `nextFireAt` so fires don't follow the stale schedule. The row's `status` is intentionally preserved across redeploys — a schedule paused out-of-band stays paused.
- Orphan deletion: when an array-form entry is removed across deploys (or a workflow is migrated from single-form to array-form), storage rows owned by a registered workflow but no longer in its declared set are deleted. Rows belonging to workflows that are not currently registered are left alone — they may be coming back.
- `mastra.shutdown()` now stops the scheduler before tearing down the event engine and observability.

**Engine routing rule:**

`mastra.addWorkflow()` now throws a `MastraError` (`MASTRA_WORKFLOW_SCHEDULE_REQUIRES_EVENTED_ENGINE`) when a workflow declares a `schedule` but is not using the evented engine. Import `createWorkflow` from `@mastra/core/workflows/evented` for scheduled workflows.

**Storage requirement:**

The scheduler requires a storage adapter implementing the `schedules` domain. `@mastra/libsql` is supported today; additional adapters will follow. If the storage adapter does not provide the `schedules` domain at boot time, scheduler initialization fails with `MASTRA_SCHEDULER_STORAGE_NOT_AVAILABLE`.
