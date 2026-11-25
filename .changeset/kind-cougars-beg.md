---
'@mastra/libsql': patch
---

Improved workflow takeover on remote LibSQL databases (sqld or Turso). A worker that stops responding during a workflow write no longer holds the database's write lock until the server drops its connection. This covers snapshot saves, state drafts, v1 run deletes, run appends with a header and no status guard, and checkpoints with no status guard or state base; other workflow writes are unchanged.
