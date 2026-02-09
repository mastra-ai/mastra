---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed working memory tools being injected when no thread or resource context is provided. Made working memory tool execute scope-aware: thread-scoped requires threadId, resource-scoped requires resourceId (previously both were always required regardless of scope).
