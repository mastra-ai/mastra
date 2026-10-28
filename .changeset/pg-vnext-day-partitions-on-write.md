---
'@mastra/pg': patch
---

Fixed `PostgresStoreVNext` observability in native partition mode (no TimescaleDB or pg_partman) dropping every span, metric, log, score, and feedback event once the day partitions created by `init()` ran out. A write that lands on a day with no partition now creates that partition and retries, so traces keep flowing without a redeploy or a scheduled `init()`. Roles that cannot create tables still need to re-run `init()` at least every `futureDays` days; the PostgreSQL integration docs now say so. Fixes https://github.com/mastra-ai/mastra/issues/28644
