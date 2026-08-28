---
'@mastra/pg': patch
---

Respect PostgreSQL search-path relation visibility in PgVector when `schemaName` is omitted, so vector tables created in visible non-`public` schemas remain discoverable across listing, metadata lookup, and namespace migration.
