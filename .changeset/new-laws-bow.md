---
'@mastra/core': patch
---

Fixed untilIdle continuations replaying earlier chunks while preserving the caller runId as an abort handle for active continuation work.
