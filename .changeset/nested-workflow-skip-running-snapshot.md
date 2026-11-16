---
'@mastra/core': patch
---

Fixed evented workflows where a nested workflow's `shouldPersistSnapshot` skipped `running` snapshots. Such a nested workflow hung at a `.branch()`, passed only one `.foreach()` iteration result to the next step, and could not resume a step suspended two levels deep (`Nested workflow run id not found`). A nested run now always records its initial run row and its link on the parent, which is what the evented engine uses to merge branch results, collect foreach output, and find the run on resume. The row is still deleted when the workflow declines to persist the terminal snapshot. Top-level workflows and the default execution engine are unchanged.