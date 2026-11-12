---
'@mastra/playground-ui': patch
---

Fixed deferred tool calls whose background task was cancelled still reading as running in Studio. They now say `cancelled`, and no longer offer to answer a question the task asked before it stopped.
