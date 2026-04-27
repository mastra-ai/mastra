---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
---

Added the `schedules` storage domain — the data layer that will back upcoming scheduled-workflow support. The domain ships with an in-memory implementation in `@mastra/core` and a libsql adapter in `@mastra/libsql`. Runtime use (the scheduler component itself and Mastra wiring) will follow in subsequent releases.

This change is purely additive. No existing behavior is affected and no APIs are deprecated.

**Available now:**

- `SchedulesStorage` abstract domain with `createSchedule`, `getSchedule`, `listSchedules`, `listDueSchedules`, `updateSchedule`, `updateScheduleNextFire` (compare-and-swap), `deleteSchedule`, `recordTrigger`, and `listTriggers`
- `InMemorySchedulesStorage` default implementation
- `SchedulesLibSQL` adapter (tables: `mastra_workflow_schedules`, `mastra_workflow_schedule_triggers` — actual table names are `mastra_schedules` and `mastra_schedule_triggers`)
- Polymorphic `Schedule.target` discriminator (only the `workflow` variant is defined today; future targets can be added without a schema migration)

`@mastra/clickhouse` and `@mastra/cloudflare` adapters were touched only to keep their existing `Record<TABLE_NAMES, …>` table-name mappings exhaustive — no behavior change.
