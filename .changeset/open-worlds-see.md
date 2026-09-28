---
'@mastra/playground-ui': patch
---

Removed the workflow request context and run options dialogs from the workflow trigger. `WorkflowInformation` and `WorkflowTrigger` now accept a `runActionsSlot` render prop (receiving `resourceId` and `setResourceId`) so hosts can render their own run controls; the `onRequestContextChange` prop was removed.
