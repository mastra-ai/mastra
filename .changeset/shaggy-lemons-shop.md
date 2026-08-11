---
'@mastra/core': minor
---

Added a delegated request context to `onDelegationStart`. Each subagent run receives a context map derived from its parent, so hooks can add values before dynamic agent configuration resolves without changing the parent context.

```typescript
await supervisor.stream('Research AI trends', {
  delegation: {
    onDelegationStart: context => {
      context.requestContext.set('specialty', context.primitiveId);
    },
  },
});
```

Subagent request contexts inherit caller entries but exclude parent memory, thread, and resource identity. Setting or deleting entries during a subagent run no longer changes the parent context map or another concurrent delegation's map.
