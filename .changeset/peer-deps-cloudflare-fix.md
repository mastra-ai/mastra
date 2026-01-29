---
'@mastra/cloudflare': patch
'@mastra/core': patch
---

Fix peer dependency compatibility issues:

- Update @mastra/cloudflare peer dependency from >=1.0.0-0 to >=1.1.0-0 to ensure compatibility with new agent versioning exports (TABLE_AGENT_VERSIONS, AgentVersion) introduced in core 1.1.0.

- Add `getSchemas()`, `getSchema(tableName)`, and `hasSchema(tableName)` methods to `StorageDomain` base class. These provide a backwards-compatible way to access table schemas - packages can check for schema availability before using them, ensuring compatibility across different core versions.
