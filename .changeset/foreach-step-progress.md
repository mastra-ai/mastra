---
"@mastra/core": minor
"@mastra/playground-ui": minor
"@mastra/react": patch
---

Add `workflow-step-progress` stream event for foreach workflow steps. Each iteration emits a progress event with `completedCount`, `totalCount`, `currentIndex`, `iterationStatus` (`success` | `failed` | `suspended`), and optional `iterationOutput`. Both the default and evented execution engines emit these events.

The Mastra Studio UI now renders a progress bar with an N/total counter on foreach nodes, updating in real time as iterations complete:

```ts
// Consuming progress events from the workflow stream
const run = workflow.createRun();
const result = await run.start({ inputData });
const stream = result.stream;

for await (const chunk of stream) {
  if (chunk.type === 'workflow-step-progress') {
    console.log(`${chunk.payload.completedCount}/${chunk.payload.totalCount} - ${chunk.payload.iterationStatus}`);
  }
}
```

`@mastra/react`: The `mapWorkflowStreamChunkToWatchResult` reducer now accumulates `foreachProgress` from `workflow-step-progress` events into step state, making progress data available to React consumers via the existing workflow watch hooks.
