---
'@mastra/playground-ui': patch
'@mastra/mcp-apps-components': patch
---

Shrank the observability explorer and trace viewer MCP Apps back under their size budget. A recorded sub-agent card no longer pulls in the live chat's tool card (and with it the MCP app viewer, form and workflow graph code), and the apps keep the trace panels' recorded tool cards instead of Studio's live ones.
