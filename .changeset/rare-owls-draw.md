---
'@mastra/core': patch
---

Fixed durable agents dropping already-streamed assistant text from memory when a run is aborted mid-stream. The partial response was visible in the live stream and in the onAbort callback, but disappeared after a reload or memory recall — only the user message remained. Aborted runs now persist the partial assistant message to memory, matching the regular agent's behavior. Fixes #22593
