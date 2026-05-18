---
'@mastra/core': patch
'@mastra/libsql': patch
---

Fixed duplicate message admission retries to reuse existing evidence, preventing duplicate processing during race conditions.
