---
'@mastra/client-js': patch
---

Fix listMemoryThreads orderBy parameter serialization and type definition. The `orderBy` parameter now correctly expects an object with `field` and `direction` properties matching the server schema, and is properly JSON-serialized in the query string instead of being converted to `[object Object]`.

**Breaking change**: The `orderBy` parameter structure has changed.

**Before:**
```typescript
client.listMemoryThreads({
  resourceId: 'resource-123',
  agentId: 'agent-456',
  orderBy: 'createdAt',
  sortDirection: 'DESC'
});
```

**After:**
```typescript
client.listMemoryThreads({
  resourceId: 'resource-123',
  agentId: 'agent-456',
  orderBy: {
    field: 'createdAt',
    direction: 'DESC'
  }
});
```
