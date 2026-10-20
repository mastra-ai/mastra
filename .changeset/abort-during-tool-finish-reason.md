---
'@mastra/core': patch
---

Fixed agent runs that were aborted while a tool was running finishing with `finishReason: 'tool-calls'`. When a tool stops because the run's abort signal fired, the run now ends with `finishReason: 'aborted'`, emits an `abort` chunk, and calls `onAbort`, the same as an abort during the model response.
