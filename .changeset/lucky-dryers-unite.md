---
'@mastra/core': major
---

Renamed Harness V1 session messaging from `signal` to `sendMessage`, added `queueMessage`, and added thread subscriptions for streamed session responses.

Harness V1 sessions now use the agent thread runtime for message delivery, so callers can subscribe to session output while sending or queueing messages.

**Before**

```ts
await session.signal({ messages: 'Hello' });
```

**After**

```ts
const subscription = await session.subscribeToThread();

await session.sendMessage({ messages: 'Hello' });
await session.queueMessage({ messages: 'Follow up' });

for await (const chunk of subscription.stream) {
  // Render streamed session output.
}
```
