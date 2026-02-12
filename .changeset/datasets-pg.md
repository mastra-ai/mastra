---
'@mastra/pg': minor
---

Added composite primary key support to the PostgreSQL storage layer. `generateTableSQL` and `createTable` now accept a `compositePrimaryKey` option for tables that require multi-column primary keys (used by dataset item versioning).

**Requires `@mastra/core` >= 1.4.0**
