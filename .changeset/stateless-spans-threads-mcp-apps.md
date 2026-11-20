---
'@mastra/mcp-apps-components': patch
---

The observability explorer app now loads its traces, spans and threads tabs by calling the MCP server's tools directly, instead of going through a Mastra client. Lists load when the filters, sort or time range change and no longer refresh on a timer. Going back from an opened trace keeps the list's filters, columns and loaded rows. The thread drawer now shows all of a thread's traces even when the conversation opened the explorer with a narrower filter.
