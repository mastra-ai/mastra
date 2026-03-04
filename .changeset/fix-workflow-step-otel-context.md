---
'@mastra/core': patch
---

Fix OTEL context propagation in workflow step execution. Wrapping `step.execute()` in `executeWithContext` ensures auto-instrumented code inside a step (e.g. AI SDK spans) is correctly nested under the workflow step span rather than appearing as siblings.
