---
'@mastra/clickhouse': patch
---

Fixed trace metadata field discovery on ClickHouse versions earlier than 24.8 by preserving top-level field discovery while newer servers discover nested fields. Known-path filtering and value discovery are unaffected.
