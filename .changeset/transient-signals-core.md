---
'@mastra/core': minor
---

Add a `transient` option to agent signals for delivery-only injection.

Signals sent from a processor become part of the conversation by default: they're written to storage and re-enter the prompt on later turns. That's unwanted for a steering reminder you re-inject every turn, because copies pile up and the model starts treating its own past reminders as prior context. Set `transient: true` to deliver the signal to the model for the current call only — it appears in the prompt this turn but is not retained, so re-sending it each turn keeps a single fresh copy in context instead of an accumulating history.

```typescript
// Default: the reminder is retained and re-injected every turn (accumulates)
await sendSignal?.({ type: 'reactive', contents: 'Stay on the current task.' });

// transient: delivered for the current call only, not retained
await sendSignal?.({ type: 'reactive', contents: 'Stay on the current task.', transient: true });
```
