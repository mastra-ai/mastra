---
'@mastra/core': patch
---

Added a `pinToWorker` option to `backgroundTaskManager.enqueue()` for tasks whose work is already running in the current process. Other processes no longer pick up the queued task and run it a second time while that process is alive. If the process dies, the task uses a retry or fails, so a task with `maxRetries: 0` never runs twice. Running processes check for these tasks every `leaseDurationMs`, so they're recovered without a restart. Pinned work should be idempotent: a lapsed lease doesn't prove the original process stopped.

```ts
await mastra.backgroundTaskManager?.enqueue(payload, { executor }, { pinToWorker: true });
```
