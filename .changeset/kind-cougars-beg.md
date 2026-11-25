---
'@mastra/libsql': patch
---

A fenced snapshot save, state draft, v1 run delete, run append with a header and no status guard, or checkpoint with no status guard or state base in LibSQL now sends the run check and the write as one batch. On a remote database (sqld or Turso) these writes no longer hold the database write lock across round trips. Other fenced workflow writes are unchanged.
