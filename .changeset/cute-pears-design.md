---
'@mastra/clickhouse': patch
---

Fixed ClickHouse discovery refreshable materialized views failing with error 36 when target tables use Replicated engines inside a non-Replicated database (#21168).

Refreshable discovery views now use `REFRESH EVERY ... APPEND`, and init recreates existing non-APPEND discovery views on upgrade so installs pick up the fix.
