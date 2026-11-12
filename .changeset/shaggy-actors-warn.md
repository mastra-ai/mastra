---
'@mastra/playground-ui': patch
---

Fixed deferred tool calls whose background task was cancelled or timed out reading as still running in Studio. They now say `cancelled` or `timed out`, and Studio stops reading their task.
