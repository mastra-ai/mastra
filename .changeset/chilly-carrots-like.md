---
'@mastra/pg': patch
'@mastra/libsql': patch
---

Workflow snapshot upserts no longer overwrite a previously stored `resourceId` with NULL when a run is re-persisted without one (for example during resume).
