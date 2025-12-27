---
"@mastra/pg": patch
---

feat(pg): add `exportSchemas()` function for DDL generation without database connection

Added a new `exportSchemas(schemaName?: string)` function that exports Mastra database schema as SQL DDL statements without requiring a database connection. This is useful for:
- Generating migration scripts
- Reviewing the schema before deployment
- Creating database schemas in environments where the application doesn't have CREATE privileges

Also refactored internal code to eliminate duplication:
- Extracted `generateTableSQL()` function from `createTable()` method
- Consolidated SQL type mapping into a single `mapToSqlType()` function

