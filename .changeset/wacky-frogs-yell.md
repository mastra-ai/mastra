---
'@mastra/core': minor
---

Expanded `cancelQueuedMessages({ signalIds })` to cancel pending input across all Agents sharing the runtime and memory thread. Added `clearPendingSignals` to thread abort options.

**Changed behavior**

- Signal-ID cancellation previously matched only the calling Agent's queued messages. It now also covers other Agents' messages, pre-run signals, and signals pending in an active run.
- The `queueOwnerId` selector still cancels only the calling Agent's queued messages in that owner group.
- Cancellation remains effective during lease handoffs. Clear-on-abort prevents queued input from returning after a preparation failure.

```typescript
const thread = { resourceId: 'user-123', threadId: 'thread-abc' };

// Selected pending input across Agents sharing the thread.
agent.cancelQueuedMessages({ ...thread, signalIds: ['signal-123'] });

// Existing Agent-scoped owner-group behavior.
agent.cancelQueuedMessages({ ...thread, queueOwnerId: 'session-123' });

agent.abortThreadStream({ ...thread, clearPendingSignals: true });

// Existing behavior: abort without clearing pending input.
agent.abortThreadStream(thread);
```

Selected-ID cancellation publishes locally cancelled IDs through PubSub so other processes subscribed to the thread can remove matching pending copies. Propagation is asynchronous and best-effort. The result reports only local cancellations, without remote acknowledgements. IDs missing locally aren't published. Clear-on-abort forwards the clear flag to the active owner, but doesn't clear every process's queues. Neither operation cancels `continueWithMessages()` continuations or undoes persisted effects.
