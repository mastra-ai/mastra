---
'@mastra/core': patch
---

Background tasks that stale-task recovery marks as failed now report the failure. When a worker crashed mid-task and recovery later failed the task, `onTaskFailed` never ran and `stream()` subscribers never saw `background-task-failed`. Recovery now publishes `task.failed`, and startup recovery runs after the manager subscribes to results so that event is not lost. Only the worker whose fenced write wins reports the failure.
