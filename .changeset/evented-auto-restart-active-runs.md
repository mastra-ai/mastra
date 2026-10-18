---
'@mastra/core': patch
---

Fixed evented workflow runs, including scheduled workflows, being lost when `mastra.restartAllActiveWorkflowRuns()` ran before `startWorkers()`. These restarts now wait until the workers are running. The sweep also no longer waits for evented runs to finish before restarting other runs, skips evented snapshots with no recorded position instead of failing, and won't restart the same run twice when sweeps overlap. Fixes [#24984](https://github.com/mastra-ai/mastra/issues/24984).
