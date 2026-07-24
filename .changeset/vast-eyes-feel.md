---
'@mastra/libsql': patch
---

Fixed local LibSQL stores so concurrent writes are serialized and applications can select safer DELETE journaling for multi-process databases.
