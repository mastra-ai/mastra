---
'@mastra/code-sdk': minor
---

Add request-context-aware Dynamic Workflow access policy support to Mastra Code authoring, discovery, execution, and deletion.

```ts
import { prepareAgentControllerMount } from '@mastra/code-sdk';
import type { DynamicWorkflowAccessPolicy } from '@mastra/code-sdk/workflows/access-policy';

const workflowAccessPolicy: DynamicWorkflowAccessPolicy = {
  resolveAuthorId: ({ requestContext }) => requestContext.get('verified-user-id'),
};

await prepareAgentControllerMount({ workflowAccessPolicy });
```

Configured policies pass the trusted author to native Core APIs and fail closed for unresolved or cross-owner Dynamic Workflows while keeping code-defined workflows available.

Hosts that do not use a Mastra Code controller session can supply the Workflow Builder's native model directly or through a request-context resolver while retaining the same access policy:

```ts
import { createMastraCodeWorkflowBuilderAgent } from '@mastra/code-sdk/agents/workflow-builder-agent';

const workflowBuilder = createMastraCodeWorkflowBuilderAgent({
  model: 'openai/gpt-5.6-sol',
  accessPolicy: workflowAccessPolicy,
});
```
