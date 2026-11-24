---
'@mastra/libsql': patch
---

Fenced workflow saves in LibSQL now send the run check and the write as one batch. On a remote database (sqld or Turso) a fenced save no longer holds the database write lock across round trips, so a client cut mid-save no longer blocks other writers.
