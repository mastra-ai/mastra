---
'@mastra/core': patch
---

Fixed evented workflows losing foreach results when iterations with `concurrency` above 1 finish at the same time. When two iterations failed together, the run could publish `workflow.fail` twice, drop the first failure from the stored iteration results, and store a different error than the one the run returned. A failure that finished alongside a successful sibling could also leave the foreach step stored as `running` rather than `failed`. Iteration results are now written one at a time for each run.
