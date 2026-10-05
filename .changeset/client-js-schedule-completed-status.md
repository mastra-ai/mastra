---
'@mastra/client-js': patch
---

Added `completed` to the schedule status types. A schedule whose cron has no future occurrence reports `completed` when fetched by id, and the schedules list includes completed schedules only when you filter by `status: 'completed'` — the default listing omits them. `status` on a schedule update still only accepts `active` or `paused`.
