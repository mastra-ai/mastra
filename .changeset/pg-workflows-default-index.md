---
'@mastra/pg': patch
---

Studio's workflow runs list stays fast as workflow history grows. `@mastra/pg` now creates a default index on `mastra_workflow_snapshot(workflow_name, "createdAt" DESC)` so listing recent runs no longer scans and re-sorts the whole snapshot table on every poll.
