---
'@mastra/core': patch
---

Fixed `untilIdle` continuations losing a completed background task's result when newer messages push it outside the configured history window.
