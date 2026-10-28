---
'@mastra/pg': patch
---

Fixed `PostgresStoreVNext` observability dropping every span, metric, log, score, and feedback event once the day partitions created by `init()` ran out. This affected native partition mode (no TimescaleDB or pg_partman).

A write that lands on a day inside the partition window (yesterday to today + `futureDays`) with no partition now creates that partition and retries. Traces keep flowing without a redeploy or a scheduled `init()`.

Roles that cannot create tables, or do not own the observability tables, still need to re-run `init()` at least every `futureDays` days. The PostgreSQL integration docs now explain this.

Fixes https://github.com/mastra-ai/mastra/issues/28644
