---
'@mastra/client-js': minor
---

Added `client.resumeBackgroundTask()` to answer a suspended background task from a client.

```typescript
const task = await client.getBackgroundTask(taskId);
await client.resumeBackgroundTask(taskId, { approved: true }, { suspendedAt: task.suspendedAt });
```
