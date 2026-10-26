---
'@mastra/core': minor
---

The scheduler no longer polls storage every 10 seconds. It now sleeps until the next schedule is due (capped by `tickIntervalMs`, which now defaults to 1 hour) and stops querying storage entirely when there are no active schedules, waking again when a schedule is created, updated, or resumed. This lets serverless Postgres databases such as Neon autosuspend while the app is idle.

Schedulers started with `scheduler: { enabled: true }` keep checking storage at the `tickIntervalMs` cap even with no active schedules, so standalone workers without a shared pubsub still pick up schedules created by another process.
