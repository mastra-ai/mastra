---
'@mastra/workflow-sdk': patch
'@mastra/core': patch
---

Exposed `runScorersForStep` and its `RunScorersParams` type from `@mastra/core/workflows` so alternative workflow engines can run step scorers the same way the default engine does. The scorer runner now accepts any execution engine and works without an observability context.
