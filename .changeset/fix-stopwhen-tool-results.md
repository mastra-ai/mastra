---
'@mastra/core': patch
---

Fixed `stopWhen` callback receiving empty `toolResults` on steps. `step.toolResults` now correctly reflects the tool results present in `step.content`.
