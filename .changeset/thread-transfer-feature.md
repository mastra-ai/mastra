---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mssql': minor
'@mastra/dsql': minor
'@mastra/oracledb': minor
---

Add thread ownership transfer (resourceId reassignment).

You can now transfer an existing thread to a different resource, reassigning both the thread and its messages to the new `resourceId` while preserving the thread's original `createdAt` timestamp. This supports scenarios like moving a private thread into a shared workspace without the previous upsert workaround.

- `@mastra/core` / `@mastra/memory`: new `Memory.updateThreadResourceId({ threadId, resourceId })` method, backed by a default `MemoryStorage.updateThreadResourceId` implementation. When semantic recall is enabled, the message vectors are migrated to the new `resourceId` so resource-scoped retrieval keeps surfacing the transferred thread.
- `@mastra/server`: new `POST /memory/threads/:threadId/transfer` route. The endpoint is restricted to privileged, non-resource-scoped callers and rejects requests made with a resolved resource scope.
- `@mastra/client-js`: new `MemoryThread.transfer({ resourceId })` method.
- `@mastra/pg`, `@mastra/libsql`, `@mastra/mssql`, `@mastra/dsql`, `@mastra/oracledb`: atomic, serialized `updateThreadResourceId` overrides. The thread and all of its messages are moved inside a single transaction, so overlapping transfers of the same thread cannot interleave and leave split ownership. Postgres, SQL Server and Oracle take a row lock (`SELECT ... FOR UPDATE` / `UPDLOCK, HOLDLOCK`); libSQL serializes write transactions; Aurora DSQL relies on its optimistic concurrency control with automatic retry. Adapters without a transaction primitive fall back to the base best-effort implementation, which fails closed by reverting on error.

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
