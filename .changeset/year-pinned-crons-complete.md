---
'@mastra/core': patch
---

Fixed cron schedules whose cadence runs out. The final occurrence is now delivered once and the schedule moves to a `completed` state, editing or resuming a schedule whose cadence has no future occurrence completes it instead of failing, and an invalid cron expression or timezone is reported as an input error.
