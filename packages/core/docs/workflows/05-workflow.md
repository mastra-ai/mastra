> Documentation for the `Workflow` class in Mastra, which enables you to create state machines for complex sequences of operations with conditional branching and data validation.

# Workflow Class

The `Workflow` class enables you to create state machines for complex sequences of operations with conditional branching and data validation.

## Usage example

```typescript title="src/mastra/workflows/test-workflow.ts"
import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

export const workflow = createWorkflow({
  id: 'test-workflow',
  inputSchema: z.object({
    value: z.string(),
  }),
  outputSchema: z.object({
    value: z.string(),
  }),
});
```

## Constructor parameters

### WorkflowOptions

## Running with initial state

When starting a workflow run, you can pass `initialState` to set the starting values for the workflow's state:

```typescript
const run = await workflow.createRun();

const result = await run.start({
  inputData: { value: 'hello' },
  initialState: {
    counter: 0,
    items: [],
  },
});
```

The `initialState` object should match the structure defined in the workflow's `stateSchema`. See [Workflow State](/docs/v1/workflows/workflow-state) for more details.

## Workflow status

A workflow's `status` indicates its current execution state. The possible values are:

### Handling tripwire status

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

This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

## Related

- [Step Class](./step)
- [Workflow State](/docs/v1/workflows/workflow-state)
- [Control flow](/docs/v1/workflows/control-flow)
