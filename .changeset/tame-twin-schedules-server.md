---
'@mastra/server': minor
---

**Merged `/api/heartbeats` into `/api/schedules`.** The server now exposes one unified schedules API that covers both agent schedules (previously heartbeats) and workflow schedules.

- `GET /api/schedules` lists both kinds and supports `agentId`, `workflowId`, `status`, `threadId`, `resourceId`, and `name` filters.
- `POST /api/schedules` creates an agent schedule (body with `agentId`, `cron`, `prompt`) or a workflow schedule (body with `workflowId`, `cron`).
- `PATCH`, `DELETE`, and `POST .../pause`, `.../resume`, `.../run` work for both kinds.
- The `/api/heartbeats/*` routes were removed. Use `/api/schedules/*` instead.
