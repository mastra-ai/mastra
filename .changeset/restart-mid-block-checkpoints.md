---
'@mastra/core': patch
---

Fixed `restart()` and boot-time recovery re-running work that had already finished inside a `.parallel()` or `.foreach()` block. If the process died while the block was still running, arms and items that had completed ran their side effects a second time. Each finished arm or item is now saved as it completes, and a restart continues with the ones that were still unfinished. Fixes [#26214](https://github.com/mastra-ai/mastra/issues/26214).

Running foreach snapshots have a cumulative 16 MiB write budget per execution attempt to bound repeated writes of accumulated outputs. Exceeding it fails the run explicitly while allowing the final failure snapshot to preserve completed results. For larger trusted workloads, set `options.maxForeachCheckpointBytes` to a larger positive safe integer. Terminal snapshots are outside the budget; a fresh process or a new attempt after a terminal result receives a fresh budget.

If a parallel child rejects before returning a step result, the block now waits for already-started siblings to settle and save successful results before propagating the original error.
