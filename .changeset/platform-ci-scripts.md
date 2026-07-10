---
'@mastra/platform': patch
---

Add `test:unit` and `test:cloud` scripts matching the rest of the `workspaces/*` packages so CI's `Workspace Tests / test-unit` and `Workspace Cloud Tests` jobs can invoke them. `test:cloud` and `test` use `--passWithNoTests` since this package has no integration tests yet.
