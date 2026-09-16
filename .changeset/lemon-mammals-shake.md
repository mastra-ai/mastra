---
'@mastra/client-js': minor
---

Added `cancelQueuedMessages()` to cancel selected pending input without stopping the active run. The server propagates locally cancelled IDs through shared PubSub to other processes subscribed to the thread. The response reports only local cancellations, without remote acknowledgements. Added `clearPendingSignals` to `abortThread()` and subscription `abort()` options.

```typescript
const thread = { resourceId: 'user-123', threadId: 'thread-abc' };

await agent.cancelQueuedMessages({ ...thread, signalIds: ['signal-123'] });
await agent.abortThread({ ...thread, clearPendingSignals: true });

// Existing behavior: abort without clearing pending input.
await agent.abortThread(thread);
```
