---
'@mastra/client-js': patch
'@mastra/server': patch
---

Make agentId optional for memory read operations (getThread, listThreads, listMessages)

When workflows use multiple agents sharing the same threadId/resourceId, users can now retrieve threads and messages without specifying an agentId. The server falls back to using storage directly when agentId is not provided.
