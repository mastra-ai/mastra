---
'@mastra/upstash': patch
---

Fixed Upstash workflow snapshots being split across records when a run has a resourceId. Workflow runs are now stored under one key per run, so updates, deletes, and run listings always see and modify the same snapshot.
