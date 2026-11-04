---
'@mastra/core': patch
---

Fixed restarting a parent workflow reverting its state to a nested workflow run's copy. When a nested run finished before its parent saved the result, the restart merged the nested run's whole state snapshot over the parent's current state. The parent now records the state the nested run had handed back when it parks on it, and the re-drive merges only the nested run's own changes, so a key another step changed while the nested run was in flight keeps its newer value instead of reverting to the nested run's copy.

The recorded state is internal: it is saved with the run but kept out of the step results that `start()`, `resume()`, and a run lookup return.

Cancelling a leftover nested run whose parent finished now reports what happened: a run another process is driving, or one whose status moved since the sweep listed it, is left as it is and logged as such instead of reporting a cancel that did not happen. The next sweep decides again.
