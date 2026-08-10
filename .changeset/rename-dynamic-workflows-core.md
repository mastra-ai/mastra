---
'@mastra/core': minor
---

Renamed the beta stored workflows feature to dynamic workflows. `mastra.addStoredWorkflow()` is now `mastra.addDynamicWorkflow()`, `addStoredWorkflows()` is now `addDynamicWorkflows()`, the `StoredWorkflow*` types are now `DynamicWorkflow*`, and `workflow.origin` reports `'dynamic'` instead of `'stored'`.
