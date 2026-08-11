---
'@mastra/code-sdk': minor
---

Added Dynamic Workflow creation and management to Mastra Code, including discovery-backed authoring, immediate persistence, execution, and deletion.

```ts
import { listWorkflows, runWorkflow } from '@mastra/code-sdk/workflows/service';

const { workflows } = await listWorkflows(mastra);
const workflow = workflows[0];
if (workflow) {
  await runWorkflow(mastra, workflow.id, { topic: 'dynamic workflows' });
}
```
