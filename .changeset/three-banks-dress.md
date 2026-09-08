---
'@mastra/core': patch
'@mastra/libsql': patch
---

Fixed ordinary storage startup failing on incidental experimental Knowledge tables by initializing Knowledge only on explicit access. Added `storage.initKnowledge()` for explicit activation when automatic storage initialization is disabled.
