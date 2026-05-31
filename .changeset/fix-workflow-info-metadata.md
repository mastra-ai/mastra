---
'@mastra/core': patch
'@mastra/server': patch
---

Fix build break in `@mastra/server` caused by a `WorkflowInfo` type mismatch.

`getWorkflowInfo` was setting `metadata` on the serialized workflow info and omitting `requestContextSchema` in partial mode, but the `WorkflowInfo` type did not declare `metadata` and required `requestContextSchema`. Added `metadata` to `WorkflowInfo` and included `requestContextSchema` in the partial result so the package type-checks and builds.
