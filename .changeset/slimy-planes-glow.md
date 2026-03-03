---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed Memory.recall() to include pagination metadata (total, page, perPage, hasMore) in its response, ensuring consistent pagination regardless of whether agentId is provided. Fixes #13277
