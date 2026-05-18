---
'@mastra/core': minor
---

Harness storage adapters can now persist channel action tokens and receipts, verify duplicate callbacks, and claim receipt work for retry-safe channel action processing.

```ts
const token = await harnessStore.createOrLoadChannelActionToken(channelActionToken);
const retryBatch = await harnessStore.claimChannelActionReceipts({
  harnessName: 'default',
  channelId: 'support',
  statuses: ['received', 'failed'],
  claimId: workerId,
  limit: 25,
  now: Date.now(),
  claimTtlMs: 30_000,
});
```
