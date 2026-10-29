---
'@mastra/core': patch
---

Fixed missing failure reports for crashed background tasks. When stale-task recovery marks a crashed task as failed, `onTaskFailed` and `stream()` subscribers now receive the failure once, including during startup recovery.
