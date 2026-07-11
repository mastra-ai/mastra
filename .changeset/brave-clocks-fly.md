---
'@mastra/core': patch
---

Fixed background-task cancellation so cancelled tasks no longer look completed to the agent, terminal workflow events still surface a valid result when cancellation happens before one is produced, and completed, failed, cancelled, and suspended background tasks each get clearer continuation instructions.
