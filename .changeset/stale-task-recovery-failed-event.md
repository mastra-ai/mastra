---
'@mastra/core': patch
---

Fixed background tasks failed by stale-task recovery not firing `onTaskFailed` or emitting a `background-task-failed` stream event. When a worker crashes mid-task and the task has no retries left, recovery now publishes `task.failed` once (only from the worker whose recovery write wins), including for tasks recovered at startup.
