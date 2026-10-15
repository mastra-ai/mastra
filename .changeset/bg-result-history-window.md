---
'@mastra/core': patch
---

Fixed `untilIdle` continuations losing a completed background task's result after newer messages arrived. The continuation now always sees the result it reports.
