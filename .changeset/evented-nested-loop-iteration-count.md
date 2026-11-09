---
'@mastra/core': patch
---

Fixed evented workflows: a `dountil`/`dowhile` loop over a nested workflow that suspends now counts its own iterations after a resume. Before, it either looped forever or ended early with the nested workflow's loop count and reported success.
