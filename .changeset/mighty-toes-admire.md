---
'@mastra/clickhouse': patch
---

Fixed the Studio Traces page running out of memory or timing out on large ClickHouse databases. Trace queries now read only the traces in the selected time range instead of the whole trace table, so the cost follows the time range you pick rather than total retention. Fixes [#25141](https://github.com/mastra-ai/mastra/issues/25141).
