---
'@mastra/core': patch
---

Fixed evented workflows corrupting the execution path when restarting a run that failed inside a conditional (`.branch()`) step.

On restart the execution path is restored as the full branch path `[conditionalIndex, branchIndex]`. The conditional handler appended the re-resolved branch index onto that path instead of replacing the last segment, producing a phantom third level `[conditionalIndex, branchIndex, index]`. The branch step then ran at the wrong depth, and branch-result aggregation (which resolves the parent conditional via `executionPath.slice(0, -1)`) pointed at a level that does not exist, so the conditional's results never aggregated and the restarted run could hang or return the wrong output.

Restarts of failed conditional branches now resolve to the correct branch at the correct depth, matching the parallel handler, which already handled this case.
