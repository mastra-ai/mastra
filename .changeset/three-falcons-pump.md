---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/ai-sdk': patch
'@mastra/react': patch
'@mastra/server': patch
'@mastra/inngest': patch
---

Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires.

When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

```typescript
const run = await workflow.createRun();
const result = await run.start({ inputData: { message: 'Hello' } });

if (result.status === 'tripwire') {
  console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
  console.log('Processor ID:', result.tripwire?.processorId);
  console.log('Retry requested:', result.tripwire?.retry);
}
```

Adds new UI state for tripwire in agent chat and workflow UI.

This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).
