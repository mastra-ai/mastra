---
"@mastra/libsql": patch
"@mastra/pg": patch
---

Scheduled Harness wakeups now keep their queue admission setting after storage recovery, preventing recovered work from running in the wrong mode.
