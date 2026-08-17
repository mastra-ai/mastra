---
'@mastra/core': patch
---

Fixed durable run recovery so a reconnecting thread subscriber receives the remaining output and terminal event of a recovered run.

Only one recovery of a run can be active at a time. A second concurrent `durableAgent.recover(runId)` call now fails fast with the error `DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS` instead of restarting the run twice.
