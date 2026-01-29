---
'@mastra/cloudflare': patch
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/clickhouse': patch
'@mastra/mssql': patch
'@mastra/server': patch
---

Fix peer dependency compatibility issues and standardize on `fast-deep-equal`:

- Update @mastra/cloudflare peer dependency from >=1.0.0-0 to >=1.1.0-0 to ensure compatibility with new agent versioning exports.

- Add `getSchemas()`, `getSchema(tableName)`, and `hasSchema(tableName)` methods to `StorageDomain` base class. These provide a way to access table schemas dynamically.

- Storage adapters now use namespace imports (`import * as coreStorage`) with destructuring for cleaner access to core exports like `TABLE_AGENT_VERSIONS` and `toTraceSpans`. Peer dependency requirements (>=1.1.0-0) ensure these exports are available.

- Update server handlers to check if new Mastra methods exist before calling them:
  - `mastra.getStoredAgentById()` - check before calling in agent lookup
  - `mastra.listStoredAgents()` - check before calling in agent list and scorers
  - `agentsStore.getAgentByIdResolved()` - fall back to `getAgentById()` if not available
  - `mastra.clearStoredAgentCache()` - check before calling in stored agent update/delete

- Add `assertVersioningSupported()` helper to agent version routes that returns a 501 Not Implemented error with helpful message if versioning methods don't exist on the agents store.

- Add graceful degradation in `handleAutoVersioning()` to skip versioning entirely when core version doesn't support versioning methods.

- Standardize on `fast-deep-equal` package for deep equality comparisons instead of custom implementation. Remove custom `deepEqual` from core utils.ts and use `fast-deep-equal` in both core and server.
