---
'@mastra/client-js': patch
---

Fixed a crash when a consumer cancels an agent stream after it finishes. Cancelling the response body from agent.stream() (or its variants) could throw an uncatchable error and crash the process; closing the stream now fails safely instead.
