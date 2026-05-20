---
'@mastra/core': patch
---

Fixed task_write and task_update to auto-demote previously in_progress tasks instead of returning an error when multiple tasks are set to in_progress simultaneously.
