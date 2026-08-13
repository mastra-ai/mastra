---
'@mastra/client-js': minor
'@mastra/server': minor
---

Added an active-runs listing for agent controllers. It reports every run currently in flight on the controller from in-memory tracking — a cheap read suited to polling activity indicators, with no session created as a side effect.

```ts
const runs = await client.getAgentController('code').listActiveRuns();
// [{ runId: 'run-1', resourceId: 'workspace-a', threadId: 'thread-1' }]
```
