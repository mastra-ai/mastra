---
'@mastra/client-js': minor
---

Add `agent.abortRun(runId)` to explicitly cancel durable execution without requiring a memory thread.

```ts
const runId = crypto.randomUUID();
await agent.stream('Start the task', { runId });
await agent.abortRun(runId);
```
