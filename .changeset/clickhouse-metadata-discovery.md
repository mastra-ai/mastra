---
'@mastra/clickhouse': patch
---

Documented that recursive nested metadata field discovery requires ClickHouse 24.8 or later with `enable_analyzer=1`. Known-path filtering and value discovery continue to use targeted JSON extraction.
