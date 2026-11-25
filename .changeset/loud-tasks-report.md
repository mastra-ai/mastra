---
'@mastra/core': patch
---

Background tasks that end because their worker is gone are now reported as failures.

- A task that recovery fails after its worker crashed now fires `task.failed`, `onTaskFailed`, and a `background-task-failed` stream chunk. Before, it was only marked `failed` in storage and nothing was notified. Fixes #28331.
- A running task with `maxRetries: 0` now ends `failed` with `Worker process terminated before task completed` when its server shuts down gracefully, the same as when the server crashes. Before, shutdown marked it `cancelled` and fired `onTaskCancelled`, as if a user had cancelled it. Fixes #31306.
