---
'@mastra/react': minor
---

Added an optional `resourceId` to `useCreateWorkflowRun` and `useStreamWorkflow`, so a manually started workflow run can be attributed to a resource.

```tsx
const createWorkflowRun = useCreateWorkflowRun();
const { streamWorkflow } = useStreamWorkflow();

const { runId } = await createWorkflowRun.mutateAsync({ workflowId, resourceId: 'tenant-42' });
await streamWorkflow.mutateAsync({ workflowId, runId, inputData, requestContext: {}, resourceId: 'tenant-42' });
```
