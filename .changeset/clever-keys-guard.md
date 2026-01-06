---
'@mastra/core': minor
---

Add reserved keys in RequestContext for secure resourceId/threadId setting from middleware

This allows middleware to securely set `resourceId` and `threadId` via reserved keys in RequestContext (`MASTRA_RESOURCE_ID_KEY` and `MASTRA_THREAD_ID_KEY`), which take precedence over client-provided values for security.

