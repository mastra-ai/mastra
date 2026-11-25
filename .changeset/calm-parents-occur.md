---
'@mastra/pg': patch
---

Improved workflow takeover in Postgres. If a worker disconnects during a workflow write, another worker can take the run over as soon as the database finishes that statement, instead of waiting for the disconnected worker to commit. This covers snapshot saves, run appends without step guards, state drafts and v1 run deletes, which now also take one round trip instead of four; other workflow writes are unchanged.
