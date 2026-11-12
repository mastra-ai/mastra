---
'@mastra/client-js': patch
'@mastra/server': patch
'mastra': patch
---

Removed save_messages and search_memory from the built-in MCP memory toolset. Their HTTP endpoints remain available. Added get_working_memory to inspect thread- or resource-scoped working memory without changing stored state, including in read-only mode.
