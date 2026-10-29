---
'@mastra/core': patch
---

Fixed durable and evented agents skipping thread title generation when observational memory is configured but switched off with `observationalMemory: { enabled: false }`. These runs now title the thread, and `savePerStep` saves each step, the same as runs with no observational memory configured.
