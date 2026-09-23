---
'@mastra/inngest': patch
---

Fixed a crash when resuming a durable agent run immediately after a tool suspends. `InngestAgent.resume()` now waits for the run to finish suspending before resuming it, instead of failing with `Cannot read properties of undefined (reading 'threadId')`. Fixes #24749.
