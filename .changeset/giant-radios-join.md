---
'@mastra/pg': patch
---

Workflow run lists requested with `summary: true` now read only status and timestamp from each snapshot, so large snapshots are not transferred from the database.
