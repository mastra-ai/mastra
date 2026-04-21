---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed thread and memory FGA checks to forward the thread's owning resourceId into authorization context so providers can derive composite tenant-scoped resource IDs during thread reads, writes, and filtering.
