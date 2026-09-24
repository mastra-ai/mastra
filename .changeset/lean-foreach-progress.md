---
'@mastra/core': patch
---

Evented workflows no longer copy the whole foreach input into every iteration's progress record (`__workflow_meta.foreachOutput`). Each record keeps its status, output and suspend state; the input list stays stored once as the step payload. Saved runs no longer grow with the square of the item count.
