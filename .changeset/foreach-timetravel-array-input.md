---
'@mastra/core': patch
---

Fixed `run.timeTravel()` rejecting array `inputData` when targeting a top-level `.foreach()` step. Each array element is now validated against the step's input schema, so Studio's "Run next step" works at foreach loops.
