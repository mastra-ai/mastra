---
'@mastra/core': patch
---

Fixed background tasks whose worker crashed being re-run by every server that started, without using a retry. A crash now counts against `maxRetries`, so the task fails with `Worker process terminated before task completed` once its retries are used, instead of staying `running` and taking down each new worker. A graceful shutdown, such as a deploy, still hands the task to the next server without using a retry. Fixes #30977.
