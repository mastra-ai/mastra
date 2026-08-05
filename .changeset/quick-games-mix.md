---
'@mastra/memory': minor
---

Added persistence filtering for transient agent signals. Memory now excludes signals marked `transient: true` from standard message saves and observational-memory persistence, so per-turn reminders do not accumulate in stored thread history.

```typescript
await sendSignal?.({
  type: 'reactive',
  contents: 'Stay on the current task.',
  transient: true,
});
```
