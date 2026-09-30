---
'@mastra/core': patch
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
'@mastra/client-js': patch
'@mastra/playground-ui': patch
---

Include `threadId` and `resourceId` on lightweight trace list rows so the Thread ID and Resource ID columns render when the trace query API is unavailable.
