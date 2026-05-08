---
'@mastra/observability': patch
---

Lowered the default `maxBatchSize` on `DefaultExporter` from 1000 to 250 events. The smaller batch is a better fit for OLTP-style observability backends (Postgres, libSQL) and remains comfortably under the per-flush parsing overhead on ClickHouse. Set `maxBatchSize: 1` to emulate realtime semantics during local development.
