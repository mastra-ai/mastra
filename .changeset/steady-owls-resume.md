---
'@mastra/core': patch
---

Fixed restarted workflow runs re-running a step that had already finished. If the process stopped right after a step (or a parallel, branch, loop, foreach, or sleep) completed, restarting the run — including the automatic recovery on server startup — ran that step again. Restart now keeps the saved result and continues with the next step. Fixes [#24615](https://github.com/mastra-ai/mastra/issues/24615).
