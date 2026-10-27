---
'@mastra/core': minor
---

The scheduler no longer polls storage every 10 seconds. It now sleeps until the next schedule is due, checking storage at least once per `tickIntervalMs` (now defaulting to 1 hour) even when no schedules are active, and wakes early when a schedule is created, updated, or resumed. This lets serverless Postgres databases such as Neon autosuspend while the app is idle.

Processes that don't share a pubsub with the process creating schedules pick up new schedules within `tickIntervalMs`. Lower it if you need faster pickup.
