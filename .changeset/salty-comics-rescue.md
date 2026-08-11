---
'@mastra/core': minor
---

Added a reusable Workflow Builder authoring API for discovering registered primitives, validating complete workflow definitions, and creating strict-provider-safe builder agents. Built-in workspace tools now expose explicit output schemas so workflow authors can infer tool compatibility.

```ts
import { createWorkflowBuilderAgent } from '@mastra/core/workflows/builder';

const workflowBuilder = createWorkflowBuilderAgent({
  id: 'workflow-builder',
  name: 'Workflow Builder',
  tools: discoveryAndSaveTools,
  model,
});
```
