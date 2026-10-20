---
'@mastra/core': patch
---

Fixed background tasks staying `running` forever when their background-task workflow run ended as failed before a terminal status was saved (for example, when the storage write that marks the task completed throws). The task is now marked `failed` with the error recorded, and `onFailed`/`onTaskFailed` hooks and the `task.failed` event fire once.
