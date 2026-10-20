---
'@mastra/core': patch
---

Fixed `run.restart()` re-running work that had already finished when a workflow crashed inside a parallel block or a `.foreach()`. Restarting now runs only the parallel arms and foreach items that had not completed before the crash. Fixes #26214.
