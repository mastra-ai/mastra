---
'mastracode': patch
---

Fixed reopened task panels to use persisted current-thread tasks instead of reconstructing them from message history. Restoring tasks no longer produces completion activity, and switching threads cannot clear a newer task snapshot.
