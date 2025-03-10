---
'@mastra/memory': patch
'@mastra/core': patch
---

Added the ability to ensure the accessed thread in memory.query() is for the right resource id. ex memory.query({ threadId, resourceId }). If the resourceId doesn't own the thread it will throw an error.
