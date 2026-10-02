---
'@mastra/server': patch
---

The schedules API now reports the `completed` status. `GET /schedules` can return a schedule with `status: 'completed'`, the `status` query parameter accepts it, and pausing or resuming a completed schedule is rejected. `PATCH /schedules/:scheduleId` still only accepts `active` or `paused`, and an exhausted cadence leaves the schedule `completed`.
