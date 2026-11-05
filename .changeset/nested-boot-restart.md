---
'@mastra/core': patch
---

Fixed `mastra.restartAllActiveWorkflowRuns()` and `workflow.restartAllActiveWorkflowRuns()` restarting a nested workflow run on its own. A nested run is collected by its parent's step, so a standalone restart either ran the same steps twice while the parent was driving it, or ran an item a second time after the parent had already finished.

Both sweeps now read the parent's stored status before restarting a nested run:

- Parent suspended, or parent run missing: the nested run restarts on its own.
- Parent finished: the nested run is marked canceled.
- Parent running, waiting, pending, or paused: the nested run is left for its parent to drive.

A run left behind by a parent that restarted its item under a new run id stays as it was until a sweep sees the parent has finished, which then marks it canceled instead of restarting it.

Marking a nested run canceled is a compare-and-set taken behind the run's ownership lease. A run another process is driving, or one that finished or suspended since the sweep listed it, keeps its own status and is left as it is, so a lease that only expires later delays the cancellation to the next sweep rather than guaranteeing it in the current one.
