---
'@mastra/pg': patch
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
---

Trace query `spans.some` and `spans.none` filters on `model` and `provider` now read the dedicated span columns instead of span attributes. Spans written before those columns existed no longer match these filters. Field value discovery for `model` and `provider` reads the same columns.
