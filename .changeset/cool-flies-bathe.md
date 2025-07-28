---
'@mastra/core': patch
---

Threads are no longer created until message generation is complete to avoid leaving orphaned empty threads in storage on failure
