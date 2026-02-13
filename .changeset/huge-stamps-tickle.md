---
'@mastra/memory': patch
---

Fixed cloneThread not copying working memory to the cloned thread. Thread-scoped working memory is now properly carried over when cloning, and resource-scoped working memory is copied when the clone uses a different resourceId.
