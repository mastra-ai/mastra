---
'@mastra/core': patch
---

Fix in-memory workflow storage `getWorkflowRunById` returning `null` when `workflowName` is omitted. `workflowName` is optional in the storage contract and the pg/libsql adapters match by `runId` alone when it is not provided, but the in-memory store always compared `workflow_name === workflowName`, which never matched for an undefined name. It now matches by `runId`, only filters by `workflowName` when provided, and returns the most recent run for parity with the persistent adapters. Closes #18585.
