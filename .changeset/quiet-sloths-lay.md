---
'@mastra/workflow-sdk': patch
'@mastra/core': patch
---

Exposed `runScorersForStep` and its `RunScorersParams` type from `@mastra/core/workflows` so alternative workflow engines can run step scorers the same way the default engine does. The scorer runner now accepts any execution engine and works without an observability context.

```ts
import { runScorersForStep } from '@mastra/core/workflows';

await runScorersForStep({
  engine, // any ExecutionEngine, not just the default one
  scorers: step.scorers,
  runId,
  workflowId,
  stepId: step.id,
  input: stepInput,
  output: stepOutput,
  requestContext,
});
```
