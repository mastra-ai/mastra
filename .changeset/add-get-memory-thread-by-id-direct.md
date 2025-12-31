---
'@mastra/server': minor
'@mastra/client-js': minor
---

Add `getMemoryThreadById` method to retrieve a thread by ID without requiring `agentId`.

Threads are stored with `resourceId`, not `agentId`, so this provides a simpler way to fetch threads when you don't need agent-specific memory configuration.

```typescript
// New method - no agentId required
const thread = await mastraClient.getMemoryThreadById({
  threadId: "thread-123",
  resourceId: "resource-1",
});
```

The endpoint validates that the thread belongs to the specified `resourceId` and returns 403 if it doesn't match.
