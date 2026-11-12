---
'@mastra/core': patch
---

Fixed `agent.stream()` hanging for the whole cache outage before a run starts. When the server cache (for example Redis) is paused, partitioned, or holding commands offline, the run-ownership check now gives up after 5 seconds and refuses the run with an `AGENT_RUN_RECORD_UNAVAILABLE` error. A failed cache read returns the same error right away, with the original cache error attached as its cause. Runs never start without the ownership check, so a caller-supplied run ID that another run owns is still refused. A refused run starts nothing: it opens no trace span and leaves the output processors a suspended run is holding in place, so the retry the error asks for still resumes with them.
