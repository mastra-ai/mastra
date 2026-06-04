---
'@internal/playground': patch
---

Wire request context into dataset experiments in Studio. You can now define a dataset's `requestContextSchema` when creating or editing a dataset, set per-item `requestContext` values on dataset items, and provide run-level request context when triggering an experiment. The run dialog renders a schema-driven form when the dataset declares a `requestContextSchema`, and falls back to a raw JSON editor otherwise. This lets values like `clinicId` flow from Studio through to agent/workflow experiment runs.
