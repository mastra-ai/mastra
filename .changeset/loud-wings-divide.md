---
'@mastra/core': patch
---

Fixed tracing for runs that continue in another process. A durable agent run resumed after a restart or on another server now stays on its original trace instead of opening a second trace that never ends. Evented workflow runs restarted after a crash, or time-travelled, now trace their steps, so scores of a recovered agent run link to the run's trace.
