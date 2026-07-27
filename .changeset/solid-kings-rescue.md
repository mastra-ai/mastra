---
'@mastra/core': patch
---

Fixed the internal notification dispatcher leaving a dead `mastra_workflow_snapshot` row behind on every run. The dispatcher is scheduled every minute and its runs are never resumed, so the rows only accumulate (one report saw 41,127 of them). Dispatch runs no longer persist snapshots, and any row written before the run finished is deleted when it reaches a terminal state.

Adds a `deleteSnapshotOnFinish` workflow option for this case: with the evented engine a run always writes an initial row, so opting out of snapshot persistence alone is not enough to avoid leaving one behind.

Fixes #20254
