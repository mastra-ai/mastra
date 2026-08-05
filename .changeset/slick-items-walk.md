---
'@mastra/memory': patch
'@mastra/server': patch
---

Fixed thread-scoped Observational Memory requests without a thread ID to return a clear bad request error instead of an internal server error.
