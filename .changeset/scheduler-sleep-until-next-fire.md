---
'@mastra/core': minor
---

The scheduler no longer polls storage every 10 seconds. It now sleeps until the next schedule is due, checking storage at least once per `tickIntervalMs` (now defaulting to 1 hour) even when no schedules are active, and wakes early when a schedule is created, updated, or resumed. This lets serverless Postgres databases such as Neon autosuspend while the app is idle.

A running scheduler that doesn't share a pubsub with the process creating schedules picks up new schedules within `tickIntervalMs`. To keep such a worker's scheduler running when it has no schedules at startup, set `scheduler: { enabled: true }` or `MASTRA_WORKERS=scheduler`, and lower `tickIntervalMs` for faster pickup.
