---
'@mastra/core': patch
---

Fixed deferred aborts for paused tool calls and tool approvals. They no longer stop a new run started after switching threads or running `/new`.
