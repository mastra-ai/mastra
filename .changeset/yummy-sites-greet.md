---
'@mastra/core': patch
---

Fixed `sendSignal()`, `sendMessage()`, `queueSignal()` and `queueMessage()` ignoring `ifIdle.streamOptions.runId`. A run started for an idle thread, or queued behind an active run, now uses the id you pass, so you can set up per-run state before the run begins. Fixes #29135.

```typescript
const { accepted } = agent.sendSignal(signal, {
  resourceId: 'user-123',
  threadId: 'thread-abc',
  ifIdle: { streamOptions: { runId: 'my-run-id' } },
});
// Before: { action: 'wake', runId: '<generated id>', ... }
// After:  { action: 'wake', runId: 'my-run-id', ... }
await accepted;
```
