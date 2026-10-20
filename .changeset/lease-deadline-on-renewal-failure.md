---
'@mastra/core': patch
---

Stop an agent run whose thread lease can no longer be confirmed. Previously, if lease renewals failed with an error or never answered (for example during a Redis outage on one process), the run kept calling the model and tools after its lease expired, alongside the successor run that took over the thread. Each run now aborts once one lease TTL has passed since its last confirmed acquire or renewal, the same way it already aborts when a renewal reports the lease lost.
