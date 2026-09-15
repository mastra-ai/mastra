---
'@mastra/client-js': minor
---

Added `cancelQueuedMessages()` to cancel selected pending input on the server process handling the request without stopping the active run. Added `clearPendingSignals` to `abortThread()` and subscription `abort()` options.

```typescript
const thread = { resourceId: 'user-123', threadId: 'thread-abc' };

await agent.cancelQueuedMessages({ ...thread, signalIds: ['signal-123'] });
await agent.abortThread({ ...thread, clearPendingSignals: true });

// Existing behavior: abort without clearing pending input.
await agent.abortThread(thread);
```
