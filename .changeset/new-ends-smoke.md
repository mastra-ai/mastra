---
'@mastra/pg': patch
---

Fixed slow semantic recall in the Postgres store for threads with many messages. Recall time drops from ~30s to <500ms on threads with 7k+ messages. Also skips unnecessary queries when only semantic recall results are needed. (Fixes #11702)
