---
'@mastra/clickhouse': patch
---

Fixed `mastra dev` repeatedly reporting `MIGRATION REQUIRED` on ClickHouse Cloud after `mastra migrate` had already run successfully. The observability migration check now recognizes the engine-name variants that ClickHouse Cloud and replicated clusters use in place of `ReplacingMergeTree`.
