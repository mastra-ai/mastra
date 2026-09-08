---
'@mastra/core': patch
---

Updated Session follow-ups to share the Agent-owned thread queue and pending count across collaborators. Steering retains its abort-then-send behavior without clearing queued follow-ups. Session cleanup preserves submitted messages while cancelling unfinished local preparation.

Observe a thread's locally pending messages with the experimental Agent API:

```typescript
const unsubscribe = agent.subscribeQueuedMessages({ resourceId, threadId }, ({ count }) => {
  console.log(count);
});
```

Explicit cancellation remains available by signal ID or optional queue owner. Observation and cancellation apply only to local pending messages, not running or remote work.
