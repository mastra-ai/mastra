---
'@mastra/libsql': patch
---

Fixed `updateWorkflowState` in the LibSQL store not updating the run's `updatedAt`, so updated runs looked stale in sorting and retention.
