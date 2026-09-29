---
'@mastra/playground-ui': patch
---

Removed the workflow request context and run options dialogs from the workflow trigger. `WorkflowInformation` and `WorkflowTrigger` now accept a `runActionsSlot` render prop (receiving `resourceId` and `setResourceId`) so hosts can render their own run controls; the `onRequestContextChange` prop was removed.

Removed `TracingSettingsProvider`, `useTracingSettings`, and `WorkflowTracingRunOptions`. `WorkflowRunProvider` now takes a `tracingOptions` prop instead of reading tracing options from context.

Removed the unused `RequestContextSchemaForm` component.
