---
'@mastra/core': patch
---

Fixed retries in `dountil` and `dowhile` loops on the evented engine. Each iteration of a loop body now starts at `retryCount` 0 and gets the step's full `retries`, as on the default engine. Before, the count carried over from earlier iterations, so a body that failed once in a later iteration could run out of retries and fail the run.

If your step code reads `retryCount` inside a loop body, it now gets the attempt within the current iteration. The loop condition receives the iteration number as `iterationCount`. To use it inside the body, pass it through the step's output or workflow state.
