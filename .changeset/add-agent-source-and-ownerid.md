---
"@mastra/core": minor
"@mastra/server": minor
"@mastra/pg": minor
"@mastra/libsql": minor
"@mastra/mongodb": minor
"@mastra/client-js": minor
---

Add source field to agents and ownerId for multi-tenant filtering

- Add `source` field to Agent class to distinguish code-defined (`'code'`) vs stored (`'stored'`) agents
- Add `ownerId` field to stored agents for multi-tenant filtering
- Add `ownerId` and `metadata` filtering to `listAgents` API
- Add schema migration to automatically add `ownerId` column to existing agents tables
