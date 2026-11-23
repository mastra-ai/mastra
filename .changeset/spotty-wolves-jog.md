---
'@mastra/core': patch
---

Fixed evented workflows running the steps after a parallel or branch block twice when a run was restarted while the block was finishing. When `restart()` found one branch already done and another still running, both the restarted run and the original worker could go on past the block, so later steps ran twice. Now only one of them continues.
