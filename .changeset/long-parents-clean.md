---
'@mastra/core': patch
---

Fixed Unix socket pubsub clients hanging forever on startup when connecting to a broker from an older build that never acknowledges membership requests. Both `subscribe` and `unsubscribe` now proceed best-effort after a configurable timeout when no acknowledgement arrives, so newer clients no longer deadlock against legacy brokers.

Configure the timeout via the new `membershipAckTimeoutMs` option (default 5000ms):

```ts
const pubsub = new UnixSocketPubSub(socketPath, { membershipAckTimeoutMs: 5000 });
```
