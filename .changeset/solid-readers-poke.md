---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added support for grouping traces with `listTraceGroups`: traces can now be grouped by a span context key (like `threadId`) with per-group counts computed in SQL.
