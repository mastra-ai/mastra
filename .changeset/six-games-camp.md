---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed scheduler performance and correctness issues that could cause excessive Postgres CPU and noisy failed runs.

- Added missing indexes on the schedules tables that the tick loop polls every 10 seconds: `(status, next_fire_at)` on `mastra_schedules` and `(schedule_id, actual_fire_at)` on `mastra_schedule_triggers`. Without these the scheduler performed a full sequential scan on every tick.
- The scheduler tick loop is now only started when at least one workflow declares a schedule (or `scheduler.enabled` is set explicitly), so deployments without scheduled workflows no longer poll the database at all.
- The scheduler now validates that a schedule's target workflow is still registered before firing it. Schedules whose target workflow has been removed from the Mastra config are skipped for a short grace window and then deleted, so stale rows stop producing failed workflow runs forever.
- The scheduler is now lazily initialized inside `startWorkers()`. Accessing `mastra.scheduler` before `startWorkers()` runs throws a descriptive error instead of returning a half-initialized instance.
