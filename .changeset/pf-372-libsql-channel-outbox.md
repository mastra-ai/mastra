---
'@mastra/libsql': patch
---

Added LibSQL storage support for Harness v1 channel outbox. Developers using LibSQL can persist outgoing channel messages and track their delivery state:

```ts
await harness.channels.enqueueOutbox({
  channelId: 'support', bindingId, resourceId, threadId, kind, operation, target, payload,
});
await harness.channels.dispatchOutbox({ channelId: 'support' });
```
