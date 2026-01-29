---
'@mastra/clickhouse': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Added backwards-compatible guards for newer storage methods (getAgentByIdResolved, listAgentsResolved, toTraceSpans). Older storage implementations will now get a clear error message instead of a crash.
