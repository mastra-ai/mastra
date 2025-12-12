---
'@mastra/clickhouse': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

fix: make getSqlType consistent across storage adapters

- PostgreSQL: use `getSqlType()` in `createTable` instead of `toUpperCase()`
- LibSQL: use `getSqlType()` in `createTable`, return `JSONB` for jsonb type (matches SQLite 3.45+ support)
- ClickHouse: use `getSqlType()` in `createTable` instead of `COLUMN_TYPES` constant, add missing types (uuid, float, boolean)
- Remove unused `getSqlType()` and `getDefaultValue()` from `MastraStorage` base class (all stores use `StoreOperations` versions)
