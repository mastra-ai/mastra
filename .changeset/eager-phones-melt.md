---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added thread-level scoring. Scorers can now grade an entire Memory conversation thread via `client.scoreThreads({ scorerName, targets: [{ threadId }] })` or `POST /api/scores/threads/score`. The full thread is materialized and scored once, and the persisted score links back to the thread for drill-down in Studio.
