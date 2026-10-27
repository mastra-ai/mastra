---
'@mastra/core': patch
---

Fixed `run.restart()` re-running work that had already finished when a workflow crashed inside a parallel block or a `.foreach()`. Each finished parallel arm and foreach item is now saved as soon as it completes, so a restart runs only the arms and items that had not completed. An item that finishes while the previous save is still being written can run again if the process dies before that save lands. This also stops a recovered durable agent from re-running parallel tool calls that had already finished. Fixes #26214.
