---
'@mastra/duckdb': patch
---

Trimmed, deduplicated, and dropped blank tags when writing spans, matching the PostgreSQL and ClickHouse stores so tag predicates and tag value discovery see the same values.
