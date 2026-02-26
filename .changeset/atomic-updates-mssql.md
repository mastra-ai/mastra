---
'@mastra/mssql': patch
---

Added atomic `updateWorkflowResults` and `updateWorkflowState` to safely merge concurrent step results into workflow snapshots.
