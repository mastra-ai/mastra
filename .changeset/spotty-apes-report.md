---
'@mastra/libsql': patch
---

Fixed schedules failing with "no such column: owner_type" on databases created by older versions. On startup, LibSQL now adds the missing ownership columns to `mastra_schedules` and rebuilds a legacy `mastra_schedule_triggers` table in the current shape, keeping existing trigger history.
