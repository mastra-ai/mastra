---
'@mastra/core': patch
'@mastra/pg': patch
---

Prevent concurrent workflow resumes from executing the same suspended run more than once when using in-memory or PostgreSQL workflow storage.
