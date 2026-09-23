---
'@mastra/clickhouse': patch
---

Documented that nested trace metadata field discovery requires ClickHouse 24.8 or later with `enable_analyzer=1`. Known-path trace filtering and value discovery continue to use targeted JSON extraction.
