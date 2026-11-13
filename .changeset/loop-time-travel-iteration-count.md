---
'@mastra/core': patch
---

Fixed `run.timeTravel()` restarting a `dountil`/`dowhile` loop's `iterationCount` at 1 when recovering a failed iteration or resuming a suspended one with `resumeData`. The recovered iteration now keeps its count and resumes with that iteration's recorded input, unless you pass new input through `inputData` or the previous step's `context`. Loops that stop on `iterationCount` no longer run extra iterations after recovery, and now return the same result as a run that never failed. Time travelling to the body of a loop that already finished still replays the whole loop.
