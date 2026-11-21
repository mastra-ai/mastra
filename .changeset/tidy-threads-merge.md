---
'@mastra/libsql': patch
---

Fixed thread metadata updates dropping keys when two writers update the same thread at once, whether in one process or across processes. Concurrent `updateThread` and `updateThreadMetadata` calls now keep every key.
