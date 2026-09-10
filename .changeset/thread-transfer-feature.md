---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Add thread ownership transfer (resourceId reassignment).

You can now transfer an existing thread to a different resource, reassigning both the thread and its messages to the new `resourceId` while preserving the thread's original `createdAt` timestamp. This supports scenarios like moving a private thread into a shared workspace without the previous upsert workaround.

- `@mastra/core` / `@mastra/memory`: new `Memory.updateThreadResourceId({ threadId, resourceId })` method, backed by a default `MemoryStorage.updateThreadResourceId` implementation. When semantic recall is enabled, the message vectors are migrated to the new `resourceId` so resource-scoped retrieval keeps surfacing the transferred thread.
- `@mastra/server`: new `POST /memory/threads/:threadId/transfer` route. The endpoint is restricted to privileged, non-resource-scoped callers and rejects requests made with a resolved resource scope.
- `@mastra/client-js`: new `MemoryThread.transfer({ resourceId })` method.

```typescript
// Server-side, from a privileged (non-resource-scoped) context:
const thread = await memory.updateThreadResourceId({
  threadId: 'thread-123',
  resourceId: 'new-resource-456',
});

// Client-side:
const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
const thread = client.getMemoryThread('thread-123', 'agent-id');
await thread.transfer({ resourceId: 'new-resource-456' });
```
