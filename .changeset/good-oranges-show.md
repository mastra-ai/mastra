---
'@mastra/client-js': minor
---

Added typed client support for transient agent signals. Use `transient: true` with `sendSignal()` to deliver non-state context for the current model call without retaining it.

```typescript
await client.getAgent('myAgent').sendSignal({
  resourceId: 'user-1',
  threadId: 'thread-1',
  signal: {
    type: 'reactive',
    contents: 'Stay on the current task.',
    transient: true,
  },
});
```
