---
'@mastra/clickhouse': patch
---

Fixed intermittent agent hangs when ClickHouse observability storage was configured. On Replicated/Shared MergeTree, every `ALTER` bumps the table's metadata version even when the change is a no-op, so re-issuing `ADD COLUMN IF NOT EXISTS`, `ADD INDEX IF NOT EXISTS`, and `MODIFY TTL` statements on every process boot caused replica catch-up races. When a replica fell behind, init failed with "metadata version on replica is N, while common metadata is N+1. Please retry this query.", the storage proxy cached the rejected init promise, and every subsequent storage call hung — including memory and trace writes during streaming.

Init now introspects `system.columns`, `system.data_skipping_indices`, and `system.tables.create_table_query` and skips ALTERs whose target is already in place. On a steady-state database init issues zero ALTERs, eliminating the metadata churn.
