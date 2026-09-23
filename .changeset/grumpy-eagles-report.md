---
'@mastra/inngest': patch
---

Fixed a crash when resuming a durable agent run immediately after a tool suspends. Resuming a run that is not suspended now rejects with a clear error. Fixes #24749.
