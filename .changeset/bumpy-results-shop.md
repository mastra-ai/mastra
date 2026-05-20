---
'@mastra/core': patch
---

Fixed task_update to auto-demote previously in_progress tasks instead of returning an error when moving another task to in_progress.
