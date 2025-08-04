---
"@mastra/core": patch
---

Fixed a bug in parallel workflow execution where resuming only one of multiple suspended parallel steps incorrectly completed the entire parallel block. The fix ensures proper execution and state management when resuming from suspension in parallel workflows.
