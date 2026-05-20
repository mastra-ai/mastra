---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added missing database indexes on schedules tables that are critical for the scheduler tick-loop polling query. Without these indexes, the `listDueSchedules` query performed a full sequential scan on every tick (default every 10 seconds), which could cause excessive CPU usage on the Postgres instance — especially with multiple Mastra replicas. Indexes added: `(status, next_fire_at)` on `mastra_schedules` and `(schedule_id, actual_fire_at)` on `mastra_schedule_triggers`.
