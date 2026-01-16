---
'@mastra/inngest': patch
'@mastra/core': patch
---

Add additional context to workflow `onFinish` and `onError` callbacks

The `onFinish` and `onError` lifecycle callbacks now receive additional properties:

- `runId` - The unique identifier for the workflow run
- `workflowId` - The workflow's identifier
- `resourceId` - Optional resource identifier (if provided when creating the run)
- `getInitData()` - Function that returns the initial input data passed to the workflow
- `mastra` - The Mastra instance (if workflow is registered with Mastra)
- `requestContext` - Request-scoped context data
- `logger` - The workflow's logger instance
- `state` - The workflow's current state object

```typescript
const workflow = createWorkflow({
  id: 'order-processing',
  inputSchema: z.object({ orderId: z.string() }),
  outputSchema: z.object({ status: z.string() }),
  options: {
    onFinish: async ({ runId, workflowId, getInitData, logger, state, mastra }) => {
      const inputData = getInitData();
      logger.info(`Workflow ${workflowId} run ${runId} completed`, {
        orderId: inputData.orderId,
        finalState: state,
      });

      // Access other Mastra components if needed
      const agent = mastra?.getAgent('notification-agent');
    },
    onError: async ({ runId, workflowId, error, logger, requestContext }) => {
      logger.error(`Workflow ${workflowId} run ${runId} failed: ${error?.message}`);
      // Access request context for additional debugging
      const userId = requestContext.get('userId');
    },
  },
});
```
