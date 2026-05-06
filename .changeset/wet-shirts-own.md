---
'@mastra/core': patch
---

Background tasks now run as evented workflows. Each task is dispatched as a workflow run that owns executor invocation, retries, and suspend/resume; pubsub topics, lifecycle event shapes, concurrency gating, and the `BackgroundTaskManager.stream()` contract are unchanged.

Add suspend/resume to background tasks. Tools can call `ctx.agent.suspend(data)` from `execute` to pause a task and release the concurrency slot; resume with `mastra.backgroundTaskManager.resume(taskId, resumeData)` or `agent.resumeStreamUntilIdle(resumeData, { runId, toolCallId })`. Surfaces `background-task-suspended` / `background-task-resumed` chunks on `backgroundTaskManager.stream()` and `agent.streamUntilIdle().fullStream`.
