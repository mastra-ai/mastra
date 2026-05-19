---
'@mastra/core': patch
---

Added channel outbox support for reliable outbound channel delivery. Developers can enqueue an outgoing channel message once, then dispatch due outbox items with delivery status tracking.

```ts
await harness.channels.enqueueOutbox({
  channelId: 'support',
  idempotencyKey: 'message-123',
  resourceId: 'resource-1',
  threadId: 'thread-1',
  target: { platform: 'slack', externalThreadId: 'thread-ext-1' },
  kind: 'assistant-message',
  operationKind: 'message-create',
  payload: { text: 'Hello' },
});

const result = await harness.channels.dispatchOutbox({ channelId: 'support' });
console.log(`Sent: ${result.sent}, Failed: ${result.failed}`);
```
