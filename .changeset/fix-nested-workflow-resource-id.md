---
"@mastra/core": patch
---

Fixed nested workflow runs not inheriting `resourceId` from the parent workflow. When a workflow is invoked as a step inside a parent workflow that was created with a `resourceId`, child workflow snapshots are now correctly persisted with the parent's `resourceId`, maintaining tenant/resource association across nested workflows.
