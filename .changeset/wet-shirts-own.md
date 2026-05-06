---
'@mastra/core': patch
---

Add workflow engine for background task execution and default it to use the workflow engine.
The background task engine now defaults to `'workflow'`, where each task runs as an evented workflow registered on Mastra. The pubsub topics, lifecycle event shapes, concurrency gating, and `stream()` contract are unchanged. Set `engine: 'legacy'` to opt back into the previous in-manager dispatch loop.

```ts
new Mastra({
  // ...
  backgroundTasks: {
    enabled: true,
    // engine defaults to 'workflow' — set to 'legacy' to opt out
    engine: 'legacy',
  },
});
```

Add suspend/resume to background tasks. Tools can call `suspend(data)` from `execute` to pause a task and release the concurrency slot; resume with `mastra.backgroundTaskManager.resume(taskId, resumeData)` or `agent.resumeStreamUntilIdle(resumeData, { runId, toolCallId })`. Surfaces `background-task-suspended` / `background-task-resumed` chunks on `backgroundTaskManager.stream()` and `agent.streamUntilIdle().fullStream`. Requires `engine: 'workflow'` (the default).
