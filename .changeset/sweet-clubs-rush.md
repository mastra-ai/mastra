---
'@mastra/core': minor
---

Added a `@mastra/core/workflows/builder` export with the shared authoring contract for stored workflow definitions.

The new export publishes the supported step types (`WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES`), the `WorkflowBuilderDefinition` graph-entry types derived from the serialized step-flow contract, and normalization helpers (`normalizeWorkflowBuilderDefinition`, `normalizeEntry`, `normalizeJsonValue`), so any authoring surface can produce and normalize draft definitions against the same shape the server validates on save.
