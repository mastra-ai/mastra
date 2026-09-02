---
'@mastra/core': patch
---

Fixed the scheduler polling storage every 10 seconds in apps that never create a schedule, which kept Railway/Neon-style deployments from scaling to zero. The scheduler now runs a single `listSchedules()` check at boot and only starts polling when a schedule exists or is created (or when `scheduler: { enabled: true }` / `MASTRA_WORKERS=scheduler` opts in explicitly), and worker processes learn about schedules created by the API process through the shared PubSub backend instead of constant polling. Also fixed deferred notifications sent from a `workers: false` API process never being dispatched: that process now registers the dispatcher schedule so a standalone worker can run it.
