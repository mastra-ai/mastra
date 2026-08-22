---
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/pg': patch
---

The dev and build server now register the internal durable scoring workflow so live scorer executions get durable run records with retry.
