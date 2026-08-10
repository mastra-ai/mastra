---
'@mastra/clickhouse': patch
---

Downgrade ClickHouse replication check on pre-existing local tables from an error to a warning log and add `allowMixedEngines: true` opt-out configuration option.
