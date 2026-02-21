---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
---

Extended `SwapBufferedToActiveResult` to include `suggestedContinuation` and `currentTask` from the most recent activated buffered chunk. Updated all storage adapters to populate these fields during activation.
