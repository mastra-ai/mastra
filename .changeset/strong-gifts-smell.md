---
'@mastra/core': patch
---

Fixed evented foreach steps keeping a `suspendedAt` timestamp after the step successfully resumed and finished. The evented engine now matches the default engine.
