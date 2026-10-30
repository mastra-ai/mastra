---
'@mastra/core': patch
---

Durable and evented agents now save the turn when a total timeout (`modelSettings.timeout.totalMs`) ends the run. Previously the work done before the deadline was lost. Now completed steps, tool results that arrive just after the deadline, and an abort notice for tools that never return are written to memory, after output processors run.

The user's message is also kept when the deadline fires while it is still being saved.

The timeout error can reach the caller up to about 1.5 seconds after the deadline, while the agent waits for running tools to settle and the save to finish.
