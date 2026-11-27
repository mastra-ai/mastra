---
'@mastra/core': patch
---

Removed the 30 second lock the evented engine took on each step event. A step event that the broker delivers again while the step is still running is no longer dropped, so the step's code can run a second time. With `@mastra/pg` or `@mastra/libsql`, the step guards keep one result for each step. Individual `foreach` items and storage adapters without step guards have no protection against a step event delivered again. You no longer need to keep `reclaimIdleMs` at 30 seconds or more for evented workflows.
