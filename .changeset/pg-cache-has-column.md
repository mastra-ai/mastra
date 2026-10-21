---
'@mastra/pg': patch
---

Stop querying `information_schema.columns` on every `listWorkflowRuns({ resourceId })` call. Column existence checks outside `init()` are now cached per store instance and cleared when schema changes are made through the store, the same way column types already were.
