---
'@mastra/client-js': patch
---

Added `completed` to the schedule status types. Schedule responses report `completed` for a schedule whose cron has no future occurrence, the `status` filter on the schedules list accepts it, and `status` on a schedule update still only accepts `active` or `paused`.
