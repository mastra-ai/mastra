---
'@mastra/core': minor
---

Added `transient` to non-state agent signals. Set `transient: true` when a processor should deliver a reminder to the current model call without retaining it in conversation history.

```typescript
await sendSignal?.({
  type: 'reactive',
  contents: 'Stay on the current task.',
  transient: true,
});
```
