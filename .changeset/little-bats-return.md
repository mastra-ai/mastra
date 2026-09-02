---
'@mastra/clickhouse': patch
---

Added observability feedback and score deletion. ClickHouse records deletion requests, retains them for 45 days, and immediately hides matching rows with lightweight deletes. Physical purge depends on configured signal retention, which open source deployments don't enable by default. Rows in the short-lived delta tables aren't touched and expire within two days.
