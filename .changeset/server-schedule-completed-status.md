---
'@mastra/server': patch
---

The schedules API now reports the `completed` status. `GET /schedules/:scheduleId` can return a schedule with `status: 'completed'`, and `GET /schedules` includes completed schedules when filtered by `status=completed` — the default listing omits them. The `status` query parameter accepts `completed`, and pausing or resuming a completed schedule is rejected. `PATCH /schedules/:scheduleId` still only accepts `active` or `paused`, and an exhausted cadence leaves the schedule `completed`.
