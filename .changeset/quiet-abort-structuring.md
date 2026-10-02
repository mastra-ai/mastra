---
'@mastra/core': patch
---

Cancelling a run while structured output is being generated no longer logs a false "Structured output processing failed" error. The structuring model call is now cancelled along with the run, and no output chunks are written after the run's stream has closed.
