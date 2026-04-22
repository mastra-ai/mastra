---
'@mastra/clickhouse': patch
---

Fixed `ReplacingMergeTree` engine detection on ClickHouse Cloud and replicated clusters. Previously, the observability migration check only accepted the literal `ReplacingMergeTree` engine name, but ClickHouse Cloud silently rewrites it to `SharedReplacingMergeTree` (and self-managed replicated clusters rewrite it to `ReplicatedReplacingMergeTree`). This caused `mastra dev` to repeatedly throw `MIGRATION REQUIRED` on CH Cloud even after `npx mastra migrate` ran successfully. The check now accepts any `*ReplacingMergeTree` variant.
