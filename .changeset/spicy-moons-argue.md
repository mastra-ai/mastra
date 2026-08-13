---
'@mastra/core': minor
---

Added `Agent.listActiveThreadRuns()` and `AgentController.listActiveThreadRuns()`. They list every run currently in flight across resources and threads, from the same in-process tracking as `getActiveThreadRunId()`.

```ts
const runs = agent.listActiveThreadRuns();
// [{ runId: 'run-1', resourceId: 'workspace-a', threadId: 'thread-1' }]
```
