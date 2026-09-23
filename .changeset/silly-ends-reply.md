---
'@mastra/clickhouse': patch
---

Fixed ClickHouse delta polling for scores returning the same score again after a retried or duplicate insert. Delta reads now return each score once, in the first poll after it was written, and always with its latest values.
