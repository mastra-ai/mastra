---
'@mastra/core': patch
---

Reduced the size of stored agent run snapshots. Completed steps of an agent run no longer keep a copy of the whole conversation, which previously made snapshots grow with every step of every turn and could push long conversations past a storage provider's document size limit. Resuming a suspended run, tool approvals, and run recovery are unchanged.
