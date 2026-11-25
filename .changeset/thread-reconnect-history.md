---
'@mastra/client-js': minor
---

Added `reconnect.withInitialHistory` to `processDataStream()` for thread subscriptions. Each resubscription then starts with the stored history, so a stream that ended or broke catches up on what it missed while it was down.

```typescript
await subscription.processDataStream({
  onChunk,
  reconnect: { withInitialHistory: true },
})
```
