---
'@mastra/core': patch
---

Fixed `stopWhen` callback receiving empty `toolResults` on steps. The field was read from `output.toolResults` which is never populated by the execution pipeline. Now derived from step content, matching `DefaultStepResult`'s existing pattern.
