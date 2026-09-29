---
'@mastra/clickhouse': patch
---

Fixed the Studio Traces page running out of memory or timing out on large ClickHouse databases. Trace queries no longer read every stored trace's full data before applying the selected time range, which cuts memory use and data read on large tables. Fixes [#25141](https://github.com/mastra-ai/mastra/issues/25141).
