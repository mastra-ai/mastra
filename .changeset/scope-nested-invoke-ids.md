---
'@mastra/inngest': patch
---

Fixed a nested workflow inside a `dountil`/`dowhile` loop or `foreach` being invoked with the same Inngest step ID on every iteration, which made Inngest return the first iteration's memoized result for every later one. The invoke and result IDs now include the loop iteration and foreach index past the first.
