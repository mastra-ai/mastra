---
'@mastra/core': minor
---

Added thread-scoped pending signal cancellation and optional clear-on-abort.

- Cancel selected local signals across Agents without stopping the active run.
- Pass `clearPendingSignals: true` to clear pending input before aborting. Default abort behavior still preserves queued input.
- Keep cancellation effective while a queued signal waits for its lease, including failed or contested handoffs.
- Prevent queued input from being restored if preparation fails after clear-on-abort.
- Notify queue-count listeners after applying clear-on-abort so newly submitted input survives.

```typescript
const thread = { resourceId: 'user-123', threadId: 'thread-abc' };

agent.cancelPendingSignals({ ...thread, signalIds: ['signal-123'] });
agent.abortThreadStream({ ...thread, clearPendingSignals: true });

// Existing behavior: abort without clearing pending input.
agent.abortThreadStream(thread);
```

Selected-ID cancellation is process-local. Clear-on-abort also forwards the clear flag to the active owner, but doesn't clear every process's queues. Neither operation cancels `continueWithMessages()` continuations or undoes persisted effects.
