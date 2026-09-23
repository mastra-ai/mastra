---
'@mastra/core': patch
---

Fixed restarted workflow runs re-running a step that had already finished. If the process stopped right after a step (or a parallel, branch, loop, foreach, or sleep) completed, restarting the run — including the automatic recovery on server startup — ran that step again. Restart now keeps the saved result and continues with the next step. For sleeps, set an explicit id (for example `.sleep(1000, { id: 'pause' })`) so restart can match the saved result. Fixes [#24615](https://github.com/mastra-ai/mastra/issues/24615).
