---
'@mastra/core': patch
---

Fixed durable agent startup recovery so unrelated runs can recover concurrently. Timed-out attempts are checked again after settlement without starting duplicate executions or releasing live ownership.
