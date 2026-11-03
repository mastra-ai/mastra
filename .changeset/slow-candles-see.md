---
'@mastra/agent-builder': minor
---

Added `createAgentBuilderWorkflows()`, which returns a new set of agent-builder workflows on every call. A workflow uses the storage of the last Mastra instance that registered it and keeps its unfinished runs, so processes that run several Mastra instances should give each one its own set instead of sharing `agentBuilderWorkflows`. `createAgentBuilderTemplateWorkflow()`, `createWorkflowBuilderWorkflow()` and `createPlanningAndApprovalWorkflow()` build a single workflow the same way. The existing exports are unchanged.

```ts
import { createAgentBuilderWorkflows } from '@mastra/agent-builder';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({ workflows: createAgentBuilderWorkflows() });
```
