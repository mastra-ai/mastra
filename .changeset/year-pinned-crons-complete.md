---
'@mastra/core': patch
---

Fixed cron schedules whose cadence runs out, such as year-pinned crons.

- The final occurrence now fires once, and the schedule then moves to `completed`.
- Editing or resuming a schedule with no future occurrence now completes it instead of failing, whatever status the row held.
- An invalid cron expression or timezone now returns an input error (400) instead of a server error.
- `ScheduleStatus` now includes `completed`, so code that switches over every schedule status needs a branch for it.
