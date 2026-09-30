---
'@mastra/factory': patch
'@mastra/clickhouse': patch
'@mastra/modal': patch
'@mastra/server': patch
'mastracode': patch
'@mastra/core': patch
---

Fixed A2A `tasks/list` returning the full message history when `historyLength` is 0. It now returns no history, as requested.
