---
'@mastra/mcp': patch
---

Fix timeout parameter position in listTools call

The MCP SDK's `listTools` signature is `listTools(params?, options?)`. Timeout was incorrectly passed as params (1st arg) instead of options (2nd arg), causing timeouts to not be applied to requests.

