---
'@mastra/cloudflare': patch
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/clickhouse': patch
---

Fix peer dependency compatibility issues:

- Update @mastra/cloudflare peer dependency from >=1.0.0-0 to >=1.1.0-0 to ensure compatibility with new agent versioning exports.

- Add `getSchemas()`, `getSchema(tableName)`, and `hasSchema(tableName)` methods to `StorageDomain` base class. These provide a backwards-compatible way to access table schemas - packages can check for schema availability before using them, ensuring compatibility across different core versions.

- Update storage adapters (pg, libsql, mongodb, cloudflare, clickhouse) to use local constants for `TABLE_AGENT_VERSIONS` instead of importing from core, avoiding import failures with older core versions.

- Update storage adapters to use `getSchema()` method in `init()` for backwards-compatible table creation.
