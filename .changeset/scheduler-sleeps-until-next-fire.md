---
'@mastra/core': patch
---

Improved the scheduler so it no longer queries storage every 10 seconds when nothing is due. It now waits until the next schedule is due, and with no active schedules it waits without any timer. Schedules created, updated or resumed through Mastra wake it right away; a schedule written straight to storage is noticed at the next wake or restart. Servers that share a store but not a pubsub (the default pubsub is per-process) only learn about schedules created elsewhere if they use a shared pubsub or turn on `scheduler: { enabled: true }`, which keeps checking at the configured interval.
