---
'@mastra/core': patch
---

`PROCESSOR_WORKFLOW_FAILED` now keeps the underlying error as its `cause`. Previously the failure text included the error message but dropped the error object, so callers could not inspect the original stack, error type or provider fields; the failed workflow's error (or the failed step's error) is now attached.
