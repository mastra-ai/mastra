---
'@mastra/core': patch
---

Fix workflow createRun() to properly handle resourceId parameter and read from RequestContext

Workflows now correctly handle the `resourceId` parameter, matching the behavior of agents:

- `EventedWorkflow.createRun({ resourceId })` now passes resourceId to the run and persists it in storage
- Workflows read `MASTRA_RESOURCE_ID_KEY` from RequestContext, allowing middleware to securely set resourceId
- RequestContext values take precedence over parameters for security (prevents resourceId hijacking)
- resourceId persists through workflow suspend/resume cycles

This fixes issue #11082 where the resourceId column in `mastra_workflow_snapshot` remained empty.
