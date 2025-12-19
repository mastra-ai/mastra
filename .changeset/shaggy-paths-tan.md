---
'@mastra/core': patch
---

When a workflow step is resumed, the writer parameter was not being properly passed through, causing writer.custom() calls to fail. This fix ensures the writableStream parameter is correctly passed to both run.resume() and run.start() calls in the workflow execution engine, allowing custom events to be emitted properly during resume operations.
