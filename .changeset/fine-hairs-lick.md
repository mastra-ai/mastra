---
'@mastra/core': patch
---

Updated Session follow-ups to share the Agent-owned thread queue and pending count across collaborators. Steering retains its abort-then-send behavior without clearing queued follow-ups. Session cleanup preserves submitted messages while cancelling unfinished local preparation.

**Breaking change:** replace `subscribeQueuedMessages({ resourceId, threadId }, listener)` with `subscribeThreadEvents({ resourceId, threadId }, listener)`. The listener now receives a typed event instead of a `{ count }` snapshot:

```typescript
const unsubscribe = agent.subscribeThreadEvents({ resourceId, threadId }, event => {
  if (event.type === 'queue-count-changed') {
    console.log(event.count);
  }
});
```

This API currently reports only local pending queue counts, not composite thread state or individual message lifecycle events. Explicit cancellation remains available by signal ID or optional queue owner. Observation and cancellation apply only to local pending messages, not running or remote work.
