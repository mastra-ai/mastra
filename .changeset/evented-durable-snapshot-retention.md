---
'@mastra/core': patch
---

Fixed durable agents on the evented engine ballooning workflow snapshots until the process ran out of memory. The evented engine writes step results through `updateWorkflowResults`, which merges the new record into the stored row without running the workflow's `pruneSnapshot` hook, so every completed step kept its full `payload` and `output`. For the durable agent loop that meant each step re-embedded the whole iteration state (the monotonically growing `accumulatedSteps`, `messageListState`), and because each merge re-reads and re-serializes the whole row, both the stored snapshots and the heap cost of every subsequent step grew without bound. The evented engine now applies the prune hook after each non-parallel step completion, and the durable agent loop no longer opts into blanket `retainRunningHistory` now that declared `stepResultReads` cover the only same-iteration step-result reads.
