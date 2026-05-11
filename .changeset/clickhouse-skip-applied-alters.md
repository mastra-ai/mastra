---
'@mastra/clickhouse': patch
---

Fixed agent streams intermittently hanging when observability storage was backed by Replicated/Shared ClickHouse. Startup no longer re-applies no-op schema updates (e.g. `ADD COLUMN IF NOT EXISTS`, `ADD INDEX IF NOT EXISTS`, `MODIFY TTL`), so it no longer triggers replica-lag retry errors that could leave storage in a stuck state.
