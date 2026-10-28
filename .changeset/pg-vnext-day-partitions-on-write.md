---
'@mastra/pg': patch
---

Fixed `PostgresStoreVNext` observability dropping every span, metric, log, score, and feedback event once the day partitions created by `init()` ran out. This affected native partition mode (no TimescaleDB or pg_partman).

A write that lands on a day inside the partition window (yesterday to today + `futureDays`) with no partition now creates that partition and retries. Traces keep flowing without a redeploy or a scheduled `init()`.

If your app's database role cannot create tables, or does not own the observability tables, call the new `ensurePartitions()` on a schedule, at least every `futureDays` days, with a role that owns those tables. A write that fails for this reason now names the table, the missing day, and this fix.

```ts
await storage.ensurePartitions();
```

Fixes https://github.com/mastra-ai/mastra/issues/28644
