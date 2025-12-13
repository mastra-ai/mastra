---
'@mastra/core': patch
---

Fixed AbortSignal not propagating from parent workflows to nested sub-workflows in the evented workflow engine.

Previously, when canceling a parent workflow, the `abortSignal` was not passed to nested workflow steps, causing child workflows to continue running after the parent was cancelled. This change:

- Tracks AbortController instances per workflow run
- Maintains parent-child relationships for nested workflows
- Cascades cancellation to all child workflows when a parent is cancelled

Fixes #11063
