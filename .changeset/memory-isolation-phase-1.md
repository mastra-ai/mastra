---
"@mastra/memory": patch
"@mastra/core": patch
---

The `Memory.getThreadById` method now supports optional resource scoping to prevent cross-tenant access. You can now pass a `resourceId` to ensure the retrieved thread belongs to the correct resource.

Example:
```typescript
// Backwards compatible
const thread = await memory.getThreadById({ threadId: 'my-thread' });

// Resource scoped
const scopedThread = await memory.getThreadById({ 
  threadId: 'my-thread', 
  resourceId: 'my-resource' 
});
```
