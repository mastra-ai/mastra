---
'@mastra/core': patch
---

Fixed durable agent runs saving every tool output a second time in their final snapshot, which made the last snapshot write noticeably larger than the earlier ones.
