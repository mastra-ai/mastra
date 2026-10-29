---
'@mastra/clickhouse': patch
---

Fixed span timestamps being stored as 9999-12-31 on ClickHouse 26.8 and later. Span start, end and update times are now written as ISO strings, which every ClickHouse version reads the same way.
