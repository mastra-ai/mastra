---
'@mastra/pg': patch
---

Fixed `@mastra/pg` listing endpoints (agents, MCP clients, MCP servers, prompt blocks, scorer definitions, skills, and workspaces) so a single row with a malformed value no longer returns HTTP 500 and hides every other record in the Mastra Editor. Listings now tolerate the bad row and return the rest.

Fixes #16224.
