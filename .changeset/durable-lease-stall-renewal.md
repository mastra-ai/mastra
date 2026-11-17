---
'@mastra/core': patch
---

Fixed durable agent runs failing with `DURABLE_AGENT_EXECUTION_UNVERIFIED` when a blocking tool call or a garbage-collection pause kept the event loop busy past the run's lease. The heartbeat woke up after the local lease deadline and declared the claim lost without asking the store whether it still held the run, so a run that had never been taken over failed and stopped without writing. The heartbeat now makes one bounded renewal attempt at the deadline first: if the store still lists this execution as the owner the lease is extended and the run continues, and if another execution has claimed the run the attempt returns `superseded` as before. A store that cannot answer still fails the run, so an unresponsive database cannot keep an execution alive.
