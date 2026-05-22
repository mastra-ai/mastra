---
'@mastra/core': patch
---

Fixed agent crash when `backgroundTasks.enabled: true` is combined with a tool whose `inputSchema` uses Zod's `.refine()` or `.superRefine()`. On Zod v4, such agents threw `Cannot overwrite keys on object schemas containing refinements` on repeated invocations and became unusable. Tools with refined input schemas now work with background tasks.
