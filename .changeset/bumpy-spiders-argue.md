---
'@mastra/core': minor
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/libsql': minor
---

Added durable Harness wakeup storage APIs for background workflows.

`@mastra/core` now provides storage APIs to create and manage durable wakeups. Wakeups can be created once and processed reliably even when workers restart.

`@mastra/libsql` stores wakeups durably and ensures workers process each wakeup once, with retry support after failures.

ClickHouse and Cloudflare storage packages now recognize wakeup storage.

```ts
const stores = await libsqlStore.getStores();
const harnessStore = stores.harness;

await harnessStore.createOrLoadHarnessWakeupItem(wakeup, {
  initialClaim: { claimId: workerId, now: Date.now(), claimTtlMs: 30_000 },
});

const [claimed] = await harnessStore.claimHarnessWakeupItems({
  harnessName: 'default',
  statuses: ['due', 'failed'],
  claimId: workerId,
  limit: 1,
  now: Date.now(),
  claimTtlMs: 30_000,
});
```
