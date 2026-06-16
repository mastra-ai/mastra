---
'@mastra/core': minor
---

Added `persistPartialOnAbort` option to `agent.stream()` to save partial output when a stream is aborted. When a stream is aborted, any text already received by the client is now optionally saved to thread history. Pass `persistPartialOnAbort: true` to opt in — default behavior is unchanged (partial output is discarded on abort).
