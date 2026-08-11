---
'@mastra/core': patch
---

Fix dedicated scheduler deployments never starting the scheduler. When `MASTRA_WORKERS=scheduler` (or any worker filter naming the `scheduler` role) is set, `startWorkers()` now always injects the SchedulerWorker instead of relying on boot-time heuristics (declarative workflow schedules or persisted agent-schedule rows) that a standalone scheduler process cannot see — it exists to fire schedule rows created by other processes. `workers: false` and `scheduler: { enabled: false }` still take precedence.
