---
'@mastra/mcp': patch
---

Fix MCP client `connect()` creating duplicate connections when called concurrently. This could leak stdio child processes or HTTP sessions. Fixes #13411.
