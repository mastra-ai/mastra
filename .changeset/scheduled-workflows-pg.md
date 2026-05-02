---
'@mastra/pg': minor
---

Added the `schedules` storage domain so Postgres-backed Mastra apps can use scheduled workflows. Creates `mastra_schedules` and `mastra_schedule_triggers` tables on init, with default indexes on `(status, next_fire_at)` for due-schedule polling and `(schedule_id, actual_fire_at)` for trigger-history queries.
