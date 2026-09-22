---
'@mastra/core': patch
---

Improved `Agent.listSuspendedRuns()` performance when filtering by `threadId`. The thread filter is now passed down to the storage query, so supporting storage adapters narrow results inside the database instead of loading and parsing every suspended snapshot for the resource. Fixes https://github.com/mastra-ai/mastra/issues/22627

```ts
await agent.listSuspendedRuns({ threadId: 'thread-123' });
```
