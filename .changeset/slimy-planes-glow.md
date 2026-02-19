---
'@mastra/memory': patch
---

Fixed Memory.recall() to include pagination metadata (total, page, perPage, hasMore) in its response. Previously, when using the /api/memory/threads/:threadId/messages endpoint with an agentId, pagination fields were omitted because recall() discarded them. Now pagination is consistently returned regardless of whether agentId is provided. Fixes #13277
