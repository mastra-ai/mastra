---
"@mastra/clickhouse": patch
---

ClickHouse-backed stores now support column names containing special characters, including quotes and backslashes, without initialization or record-loading query failures.
