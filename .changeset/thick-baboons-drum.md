---
'@mastra/core': patch
---

Fixed durable agent runs failing with `DURABLE_AGENT_EXECUTION_UNVERIFIED` when an ownership check took longer than the lease TTL (15 seconds by default) while the same process still held the run. These runs used to fail and lose their saved snapshots. They now keep running, and a step stops only when an ownership check fails, the claim can't be renewed before it expires, or another execution takes over the run.
