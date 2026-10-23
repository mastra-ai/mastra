---
'@mastra/core': patch
---

Fixed `getStepResult` and `getStepResultAsync` returning `null` for the loop body inside `.dowhile()` and `.dountil()` conditions on the evented workflow engine. Loop conditions now see the body's latest result on every iteration, matching the default engine.
