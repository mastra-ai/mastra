---
'@mastra/core': patch
---

Workflow steps, conditions, and dynamic sleeps now create their `writer` stream only when your code reads `writer`. Steps that never use it no longer allocate a stream on every run, which reduces memory churn in agent loops. Steps that call `writer.write()` or `writer.custom()` behave as before.
