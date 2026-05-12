---
'@mastra/core': minor
---

Improved Harness support for Agent thread signals.

Harness thread subscriptions now own stream processing for followed runs, echo user-message signal data with stable IDs, and support idle signal starts without delaying optimistic rendering.

```ts
const { id, accepted } = harness.sendSignal({
  type: 'user-message',
  contents: 'Follow up while the agent is still streaming',
});
await accepted;
```
