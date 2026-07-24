---
'@mastra/mcp': minor
---

Migrated MCP clients and servers to the MCP 2.0 package APIs (2.0.0-beta.5) while preserving request context, authentication, logging, and progress behavior. Tool schemas advertised over MCP no longer declare a draft-07 `$schema` dialect, which the MCP 2.0 default validator rejects.
