---
'@mastra/core': patch
---

Fixed restarting a workflow after a crash inside `.parallel()` or `.foreach()` re-running branches and items that had already finished. Each finished parallel branch and each finished foreach item is now saved as soon as it completes, so `run.restart()` and `mastra.restartAllActiveWorkflowRuns()` keep their results and only run the work that was still in progress. Previously, a crash partway through a foreach that charged customers would charge the already-processed customers again on restart.
