---
'@mastra/core': patch
---

Agents start answering sooner. The internal workflows an agent runs for every message (stream preparation, input and output processors) no longer read their run's cancel status from storage before and after each step. Nothing outside the process can cancel a run that was never stored. Workflow runs that store a snapshot still pick up a cancel issued from another process.
