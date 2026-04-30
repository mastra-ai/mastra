---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/libsql': minor
'@mastra/client-js': minor
'@mastra/playground-ui': minor
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
---

Added scheduled workflows. Declare a `schedule` field on `createWorkflow` and Mastra fires the workflow on cron — no extra wiring, no engine selection, no separate worker process to run.

**Authoring:**

- `createWorkflow({ schedule: { cron, timezone?, inputData?, initialState?, requestContext?, metadata? } })` accepts a single schedule or an array of schedules. Array entries must each carry a stable `id`; duplicates throw at construction.
- Cron expressions and timezones are validated synchronously at workflow construction time. `validateCron` and `computeNextFireAt` are exported from `@mastra/core/workflows` for adapter authors.
- The default `createWorkflow` auto-promotes a workflow to the evented engine when a `schedule` is declared, so the public Workflow API is unchanged and scheduled fires share a single execution path with manual `start()` calls.
- `inputData`, `initialState`, and `requestContext` on a declarative schedule are type-checked against the workflow's `inputSchema`, `stateSchema`, and `requestContextSchema`. Mistyped scheduled payloads fail at definition time instead of at fire time.

**Runtime:**

- `Mastra` auto-instantiates a `WorkflowScheduler` when any registered workflow declares a `schedule`. Projects with no scheduled workflows pay zero cost.
- The scheduler polls `SchedulesStorage.listDueSchedules`, advances `nextFireAt` via compare-and-swap so multiple instances polling the same storage cannot double-fire, and publishes `workflow.start` on the existing `workflows` pubsub topic. Run ids are derived deterministically from the schedule id and scheduled fire time.
- New optional `scheduler: WorkflowSchedulerConfig` on `Mastra` for `tickIntervalMs`, `batchSize`, `enabled`, and `onError`.
- Declarative schedules are upserted at boot under stable ids (`wf_${workflowId}` or `wf_${workflowId}__${scheduleId}`). Cron or timezone changes recompute `nextFireAt`. User-set status (such as a paused schedule) and fire history are preserved across redeploys. Removing an entry from a workflow's `schedule` array deletes its row on the next boot.
- `mastra.shutdown()` stops the scheduler before the event engine.

**Storage:**

- New `schedules` storage domain with `createSchedule`, `getSchedule`, `listSchedules`, `listDueSchedules`, `updateSchedule`, `updateScheduleNextFire` (CAS), `deleteSchedule`, `recordTrigger`, and `listTriggers`.
- `InMemorySchedulesStorage` ships in `@mastra/core`. `@mastra/libsql` adds the libsql adapter (`mastra_schedules`, `mastra_schedule_triggers`). The scheduler fails to initialize with `MASTRA_SCHEDULER_STORAGE_NOT_AVAILABLE` if the active storage adapter does not provide the domain.
- `Schedule.target` is polymorphic with a `workflow` variant today; future targets can be added without a schema migration.

**Pause and resume:**

- New endpoints `POST /schedules/:id/pause` and `POST /schedules/:id/resume`, with matching `client.pauseSchedule()` and `client.resumeSchedule()`. Both require `schedules:write` and are idempotent.
- Pause is durable: status is written to storage and the declarative-config upsert never overwrites it.
- Resume recomputes `nextFireAt` from now, so a long-paused schedule does not fire a backlog on resume.

**Studio:**

- `/workflows/schedules` lists every schedule across the project with the most recent run's status. Append `?workflowId=<id>` to filter to a single workflow.
- `/workflows/schedules/:scheduleId` shows the schedule's metadata, Pause/Resume controls, and the paginated trigger history. Each trigger is joined to the corresponding workflow run, with deep links to the run's graph view. The list polls every five seconds while any fired run is still active.
- A workflow's header shows a Schedules action when it has at least one schedule; one schedule links straight to detail, multiple schedules link to the workflow-filtered list.

`@mastra/clickhouse` and `@mastra/cloudflare` were touched only to keep their existing `Record<TABLE_NAMES, …>` table-name mappings exhaustive. No behavior change.

Adds a `croner` dependency.
