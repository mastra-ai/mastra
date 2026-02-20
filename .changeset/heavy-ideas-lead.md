---
'@mastra/memory': patch
---

Fixed PostgreSQL deadlock when parallel agents with different threadIds share the same resourceId while using Observational Memory. Thread scope now requires a valid threadId and throws a clear error if one is missing. Also fixed the database lock ordering in synchronous observation to prevent lock inversions.
