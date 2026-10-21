---
'@mastra/core': patch
---

Fixed authenticated agent controller sessions failing with `AGENT_MEMORY_THREAD_RESOURCE_MISMATCH` when auth uses `mapUserToResourceId`. The controller now sets the reserved memory resource and thread keys to the session's own resource and thread. Other auth values in the request context are kept.
