---
'@mastra/clickhouse': patch
---

Fixed ClickHouse observability discovery refreshable materialized views failing with error 36 when their target tables use a Replicated engine inside a non-Replicated (Atomic) database. The discovery views now refresh in APPEND mode, and existing deployments with the old view definitions are migrated automatically on startup (only the views are recreated; discovery data is kept). Fixes https://github.com/mastra-ai/mastra/issues/21168
