---
'@mastra/pg': patch
---

Respect PostgreSQL's effective `current_schema()` in PgVector catalog lookups when `schemaName` is omitted, so vector tables created through the connection search path remain discoverable.
