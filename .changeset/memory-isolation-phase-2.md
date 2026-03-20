---
"@mastra/pg": patch
"@mastra/libsql": patch
---

Added resourceId isolation across SQL storage drivers (`getThreadById` now accepts and respects `resourceId`). This ensures proper scoping of threads to resources (e.g. users, tenants).

Example:
```typescript
const thread = await memory.getThreadById({
  threadId: 'my-thread-id',
  resourceId: 'my-user-id'
});
// Will return null if the thread does not belong to 'my-user-id'
```
