---
'@mastra/memory': patch
---

Added regression coverage for resource-scoped observational memory: context loaded from a resource's other threads is accepted on the current thread, keeps its original thread ID, and is never re-saved onto the current thread.
