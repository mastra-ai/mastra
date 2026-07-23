---
'@mastra/memory': minor
---

Transient agent signals are no longer written to thread storage. A signal sent with `transient: true` is delivered to the model for the current call only — it appears in the prompt this turn but is excluded from later thread history, so re-sending a reminder each turn no longer accumulates copies in storage.

```typescript
await sendSignal?.({
  type: 'reactive',
  contents: 'Stay on the current task.',
  transient: true, // delivered this call only, never saved to the thread
});
```
