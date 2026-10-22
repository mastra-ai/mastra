---
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
'@mastra/pg': patch
---

Fixed `aggregateTraces()` cost measures dropping partly priced model calls. When Mastra can price some token types of a call but not others, `cost.sum` and `cost.avg` now include the cost of the priced token types, so totals match the cost shown in metrics. These calls still lower `cost.coverage`, because their cost is incomplete.
