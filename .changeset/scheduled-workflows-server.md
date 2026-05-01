---
'@mastra/server': minor
---

Added HTTP routes for scheduled workflows.

- `GET /api/schedules` — list schedules across the project, optionally filtered by `workflowId`.
- `GET /api/schedules/:scheduleId` — fetch a schedule with its most recent run summary.
- `GET /api/schedules/:scheduleId/triggers` — paginated trigger history joined to the corresponding workflow run.
- `POST /api/schedules/:scheduleId/pause` and `POST /api/schedules/:scheduleId/resume` — durable pause/resume. Both require `schedules:write` and are idempotent. Resume recomputes `nextFireAt` from now so a long-paused schedule does not fire a backlog.
