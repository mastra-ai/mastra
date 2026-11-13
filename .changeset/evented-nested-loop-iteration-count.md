---
'@mastra/core': patch
---

Fixed `dountil` and `dowhile` loops in evented workflows when the loop body is a nested workflow that suspends. After each resume, the loop condition now receives the correct `iterationCount`. Before this fix, the count either restarted at 1, so a count-based loop never finished, or used the nested workflow's own loop count, so the outer loop could end too early.
