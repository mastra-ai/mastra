---
'@mastra/core': minor
---

Add context parameter to `idGenerator` to enable deterministic ID generation based on context.

The `idGenerator` function now receives optional context about what type of ID is being generated and from which Mastra primitive. This allows generating IDs that can be shared with external databases.

```typescript
const mastra = new Mastra({
  idGenerator: (context) => {
    // context.idType: 'thread' | 'message' | 'run' | 'step' | 'generic'
    // context.source: 'agent' | 'workflow' | 'memory'
    // context.entityId: the agent/workflow id
    // context.threadId, context.resourceId, context.role, context.stepType

    if (context?.idType === 'message' && context?.threadId) {
      return `msg-${context.threadId}-${Date.now()}`;
    }
    if (context?.idType === 'run' && context?.source === 'agent') {
      return `run-${context.entityId}-${Date.now()}`;
    }
    return crypto.randomUUID();
  },
});
```

Existing `idGenerator` functions without parameters continue to work since the context is optional.

Fixes #8131
