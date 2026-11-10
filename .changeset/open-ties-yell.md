---
'@mastra/core': patch
---

Fixed evented workflows retrying a `dowhile` or `dountil` condition, or a `foreach` concurrency function, that throws. The run now fails on the first error, so the function and a step used as the loop body no longer run up to three times. The loop step is recorded as failed with the thrown error, and a nested workflow used as the loop body keeps its successful status.
