---
'@mastra/pg': patch
---

Added a composite index on `(status, next_fire_at)` to the `mastra_schedules` table and a composite index on `(schedule_id, actual_fire_at)` to the `mastra_schedule_triggers` table. These cover the scheduler's `listDueSchedules` and `listTriggers` hot paths. Without them, scheduler polling fell back to a sequential scan + sort, which became a problem once the tables held real data.

Indexes are created automatically on store `init()`.
