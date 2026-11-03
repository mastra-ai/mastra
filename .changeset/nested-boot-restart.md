---
'@mastra/core': patch
---

Fixed `mastra.restartAllActiveWorkflowRuns()` and `workflow.restartAllActiveWorkflowRuns()` restarting a nested workflow run on its own. A nested run is collected by its parent's step, so restarting it there either ran the same steps twice at once while the parent was driving it, or ran an item a second time after the parent had already finished. Both sweeps now read the parent's stored status: a nested run is restarted on its own only while its parent is suspended, or when its parent is gone. A run left behind by a parent that restarted its item under a new run id stays as it was until a sweep sees the parent has finished, which then marks it canceled instead of restarting it.
