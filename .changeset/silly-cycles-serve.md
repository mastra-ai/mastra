---
'@mastra/core': patch
---

Updated the `observation.blockAfter` documentation for Observational Memory: between `messageTokens` and `blockAfter` only background buffering and activation run, and a blocking observation runs at or above `blockAfter` when no buffered chunk activates.
