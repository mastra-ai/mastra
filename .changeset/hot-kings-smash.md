---
'@mastra/clickhouse': patch
---

Fixed DateTime64 comparison error with ClickHouse 26.5 by removing invalid empty string comparison on nullable DateTime64 columns in span deduplication query
