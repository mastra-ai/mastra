---
'@mastra/core': patch
---

Fixed `run.timeTravel()` restarting a `dountil`/`dowhile` loop's `iterationCount` at 1 when recovering a failed iteration. Loops that stop on `iterationCount` no longer run extra iterations after recovery, and now return the same result as a run that never failed.
