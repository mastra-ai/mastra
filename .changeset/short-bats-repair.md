---
'@mastra/server': patch
---

Fixed memory API endpoints to respect MASTRA_RESOURCE_ID_KEY and MASTRA_THREAD_ID_KEY from middleware. Previously, these endpoints ignored the reserved context keys and used client-provided values directly, allowing authenticated users to potentially access other users' threads and messages. Now when middleware sets these reserved keys, they take precedence over client-provided values for secure user isolation.
