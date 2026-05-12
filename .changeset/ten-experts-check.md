---
'@mastra/core': patch
---

Suspend and resume now works reliably for evented workflows that use parallel steps, `.branch()`, `dountil`/`dowhile` loops, and nested workflows — previously it only held up for simple linear flows.

**Parallel & `.branch()` steps** — when more than one branch suspends at the same time (e.g. each branch waits on its own approval), every suspended branch can now be resumed, the workflow stays suspended until all of them have been resumed, and the branch outputs are merged correctly. Before, only the last branch to suspend was resumable, and resuming one branch could prematurely complete the run.

**`dountil` / `dowhile` loops** — a loop body that calls `suspend()` now suspends the workflow instead of crashing the run. And after a resume, subsequent loop iterations run fresh instead of re-receiving the resume data — which previously made loops either run forever or skip their own suspend logic.

**Nested workflows** — resuming a suspended step inside a nested workflow now gives it the correct input (the output of the step right before it, not the nested workflow's own input), so it produces correct results, even when workflows are nested several levels deep. The suspended-step path returned in a workflow result is also correct now, so you can pass it straight back into `resume({ step })`.
