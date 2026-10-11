---
'@mastra/core': patch
---

Workflow steps, conditions, and dynamic sleeps now create their `writer` stream only when your code reads `writer`. Steps that never use it no longer allocate a stream on every run, which reduces memory churn in agent loops. An agent turn, including a durable agent turn, now creates only the writers its tools use. Steps that call `writer.write()` or `writer.custom()` behave as before.
