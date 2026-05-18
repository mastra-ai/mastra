---
'@mastra/libsql': minor
---

Harness channel action tokens and receipts now persist in LibSQL, so channel callback retries can be deduped and recovered across process restarts.

```ts
const stores = await libsqlStore.getStores();
const harnessStore = stores.harness;

const { token } = await harnessStore.createOrLoadChannelActionToken(channelActionToken);
const { receipt } = await harnessStore.createOrLoadChannelActionReceipt(channelActionReceipt, {
  initialClaim: { claimId: workerId, now: Date.now(), claimTtlMs: 30_000 },
});
```
