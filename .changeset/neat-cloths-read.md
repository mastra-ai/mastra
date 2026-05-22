---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed observational memory in long conversations by keeping active response timestamps ordered without advancing observation cursors past unobserved messages.
