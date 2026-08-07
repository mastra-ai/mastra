---
'@mastra/core': patch
---

Fixed Mastra shutdown so background task resources are released before storage closes without blocking indefinitely. Retryable running tasks remain recoverable after a process restart, while local executors are aborted and durable dispatches are left for surviving workers during shutdown.
