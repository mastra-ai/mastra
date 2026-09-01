---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed listing stored agents, skills, prompt blocks, scorers, MCP clients/servers and workspaces issuing one version query per entity. `listResolved()` now fetches all active versions in a single batch through a new overridable `getVersions(ids)` method on versioned storage domains, so list endpoints stay fast on database-backed storage. Fixes https://github.com/mastra-ai/mastra/issues/22524
