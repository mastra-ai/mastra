---
'@mastra/core': patch
---

Fixed agent crashes when tools with refined input schemas (`.refine()` or `.superRefine()`) run with `backgroundTasks.enabled: true`. These tools now work correctly with background tasks.
