---
'@mastra/playground-ui': minor
---

Removed workflow components that Studio and Platform no longer render.

**Removed**

- `WorkflowStepsStatus`, `WorkflowStatus`, `WorkflowCard` and `WorkflowRunOptions` from `@mastra/playground-ui/domains/workflows/workflow/*`.
- `WorkflowMapConfigDialog` and `WorkflowEntityHeader`.
- `EntityHeader` (`@mastra/playground-ui/components/EntityHeader`).
- `CheckIcon` and `CrossIcon` from `@mastra/playground-ui/icons`: use `IconCheckmark2Medium` and `IconCrossMedium` from `@mastra/playground-ui/icons/central`.
