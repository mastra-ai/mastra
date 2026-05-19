---
'@mastra/core': patch
---

Harness sessions now keep durable event replay cursors and expose non-admitting result lookups for reconnect recovery.

```ts
const replayState = await session.getEventReplayState();
const messageResult = await session.lookupMessageResult(signalId);
const queueResult = await session.lookupQueueResult(queuedItemId);
```
