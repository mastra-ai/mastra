---
'@mastra/core': patch
---

Fixed parallel `foreach` runs of nested workflows failing when an iteration suspends. Suspended iterations can now be resumed in any order without causing other iterations to fail.
