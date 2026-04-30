---
'@mastra/core': patch
---

Fixed workflow runs not being cancellable when steps or conditions ignored the abort signal. Cancelling a run now correctly stops `dountil`, `dowhile`, and `foreach` loops at every cancellation boundary — between iterations, after a step returns, after the loop condition is evaluated, and (for `foreach`) between concurrency chunks and after the final chunk. Previously, long-running loops (e.g. a `dountil` with a `setTimeout` inside the step) would keep running and eventually emit `success` even after the run was cancelled. Closes #15990.
