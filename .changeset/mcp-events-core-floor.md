---
'@mastra/mcp': patch
'@mastra/connect': patch
---

`@mastra/mcp` now requires `@mastra/core` 1.79.0 or later, the first version that exports `MCP_SERVER_EVENT_ERROR_IDS`. `@mastra/connect` requires the same version, matching the `@mastra/mcp` version it depends on.
