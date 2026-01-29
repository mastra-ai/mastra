---
'@mastra/cloudflare': patch
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/clickhouse': patch
'@mastra/server': patch
---

Fix peer dependency compatibility issues:

- Update @mastra/cloudflare peer dependency from >=1.0.0-0 to >=1.1.0-0 to ensure compatibility with new agent versioning exports.

- Add `getSchemas()`, `getSchema(tableName)`, and `hasSchema(tableName)` methods to `StorageDomain` base class. These provide a backwards-compatible way to access table schemas - packages can check for schema availability before using them, ensuring compatibility across different core versions.

- Update storage adapters (pg, libsql, mongodb, cloudflare, clickhouse) to use local constants for `TABLE_AGENT_VERSIONS` instead of importing from core, avoiding import failures with older core versions.

- Update storage adapters to use `#safeGetSchema()` helper in `init()` for backwards-compatible table creation that checks if `getSchema` method exists.

- Update server handlers to check if new Mastra methods exist before calling them:
  - `mastra.getStoredAgentById()` - check before calling in agent lookup
  - `mastra.listStoredAgents()` - check before calling in agent list and scorers
  - `agentsStore.getAgentByIdResolved()` - fall back to `getAgentById()` if not available
  - `mastra.clearStoredAgentCache()` - check before calling in stored agent update/delete

- Add `assertVersioningSupported()` helper to agent version routes that returns a 501 Not Implemented error with helpful message if versioning methods don't exist on the agents store.

- Add graceful degradation in `handleAutoVersioning()` to skip versioning entirely when core version doesn't support versioning methods.
