---
'@mastra/core': patch
---

Fixed agent runs that kept calling the model and tools after losing their thread lease. When lease renewal fails, the run is now aborted instead of running beside the run that took over the thread on another process. Applies to regular, durable and evented agents.
