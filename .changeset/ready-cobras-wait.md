---
'@mastra/libsql': patch
---

Added a composite index on `(status, next_fire_at)` to the `mastra_schedules` table and a composite index on `(schedule_id, actual_fire_at)` to the `mastra_schedule_triggers` table. These cover the scheduler's `listDueSchedules` and `listTriggers` hot paths and avoid full table scans once schedules accumulate.

Indexes are created automatically on store `init()`.
