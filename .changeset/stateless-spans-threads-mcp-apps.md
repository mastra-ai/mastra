---
'@mastra/mcp-apps-components': patch
---

The observability explorer app now loads its traces, spans and threads tabs by calling the MCP server's tools directly, instead of going through a Mastra client. The lists stay live as they do in Studio: the traces list reloads every 10 seconds, and the spans and threads lists add newly finished rows every 30 seconds without reloading the pages already shown. Going back from an opened trace keeps the list's filters, columns and loaded rows. The thread drawer now shows all of a thread's traces even when the conversation opened the explorer with a narrower filter.
