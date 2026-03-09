---
'@mastra/core': patch
'@mastra/pg': patch
---

Memory now automatically creates btree indexes on `thread_id` and `resource_id` metadata fields when using PgVector. This prevents sequential scans on the `memory_messages` vector table, resolving performance issues under high load.

Fixes #12109
