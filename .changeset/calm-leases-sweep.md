---
'@mastra/core': patch
---

Fixed a background task staying `running` until a server restarted when its worker crashed. When several servers share storage and the one running a task dies without a clean shutdown, the servers that are still up now pick the task up without a restart, normally within about one `leaseDurationMs` after its lease expires. It is retried if it has retries left, and otherwise fails with "Worker process terminated before task completed". Before, only a server that started after the crash recovered it. Fixes #31305.
