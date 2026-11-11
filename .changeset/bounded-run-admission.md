---
'@mastra/core': patch
---

Fixed `agent.stream()` hanging for the whole cache outage before a run starts. When the server cache (for example Redis) is paused, partitioned, or holding commands offline, the run-ownership check now gives up after 5 seconds and refuses the run with an `AGENT_RUN_RECORD_UNAVAILABLE` error. A failed cache read returns the same error right away, with the original cache error attached as its cause. Runs never start without the ownership check, so a caller-supplied run ID that another run owns is still refused.
