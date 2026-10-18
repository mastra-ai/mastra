---
'@mastra/core': patch
---

Evented workflows now store a `.foreach()` step as `running` while its iterations are in progress, instead of `success` with `null` placeholders. The step keeps the time the foreach started as its `startedAt`, and it gets an `endedAt` only once every iteration has finished. Fixes #27246.
