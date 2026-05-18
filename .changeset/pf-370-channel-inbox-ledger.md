---
"@mastra/core": patch
"@mastra/libsql": patch
---

[PF-370] Add durable Harness channel inbox storage so channel ingress workers can persist incoming provider callbacks, dedupe retries by provider idempotency key, recover abandoned claims after TTL expiry, and swap between in-memory local/dev storage and LibSQL-backed production storage.

```ts
const inbox = await storage.createOrLoadChannelInboxItem(channelInboxItem, {
  initialClaim: { claimId: workerId, now: Date.now(), claimTtlMs: 30_000 },
});

const retryBatch = await storage.claimChannelInboxItems({
  harnessName: 'default',
  channelId: 'support',
  statuses: ['received', 'failed'],
  claimId: workerId,
  limit: 25,
  now: Date.now(),
  claimTtlMs: 30_000,
});
```
