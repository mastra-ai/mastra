---
'@mastra/core': minor
---

Added native cron scheduling support for workflows. Workflows can now be scheduled to run on a recurring basis using standard 5-field cron expressions, without requiring external services like Inngest.

**New API:**

```typescript
// Define a workflow with a cron schedule
const billing = createWorkflow({
  id: 'daily-billing',
  inputSchema: z.object({}),
  outputSchema: z.object({ processed: z.boolean() }),
  steps: [processBilling],
  schedule: {
    cron: '0 0 * * *', // Every day at midnight
    inputData: {},
    description: 'Daily billing run',
  },
});

// Start the scheduler
const mastra = new Mastra({ workflows: { billing } });
await mastra.startScheduler();

// List scheduled workflows
mastra.listScheduledWorkflows();
// => [{ workflowId: 'daily-billing', cron: '0 0 * * *', description: 'Daily billing run' }]

// Timers are cleaned up on shutdown
await mastra.shutdown();
```

- `WorkflowConfig.schedule` — accepts `{ cron, inputData?, description? }`
- `Workflow.schedule` — getter for introspection
- `Mastra.startScheduler()` — activates cron timers for all scheduled workflows
- `Mastra.listScheduledWorkflows()` — returns scheduled workflow metadata
- `Mastra.shutdown()` — now also stops the cron scheduler
- Invalid cron expressions are rejected at workflow creation time
