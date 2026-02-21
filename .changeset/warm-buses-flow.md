---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
---

`SwapBufferedToActiveResult` now includes `suggestedContinuation` and `currentTask` from the last activated buffered chunk. Storage adapters return these fields on activation so callers can propagate continuation context.
