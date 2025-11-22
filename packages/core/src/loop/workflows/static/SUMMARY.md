# Static Workflow - Summary

## What We Built

### 1. **State Schema** (`schema.ts`)

Defines all request-specific data in a Zod schema:

```typescript
export const executionWorkflowStateSchema = z.object({
  capabilities: z.any(),    // Agent methods
  options: z.any(),          // Execution options
  runId: z.string(),         // Request ID
  methodType: z.enum([...]), // generate/stream
  // ... all request-specific data
});
```

### 2. **Refactored Step** (`prepare-tools-step.ts`)

First step that uses state instead of closures:

```typescript
export function createPrepareToolsStep() {
  return createStep({
    stateSchema: executionWorkflowStateSchema,
    execute: async ({ state }) => {
      // ✅ Gets data from state parameter
      const { capabilities, options, runId } = state;
      // No closures capturing request data!
    },
  });
}
```

### 3. **Workflow Factory** (`index.ts`)

Creates a reusable workflow without request data:

```typescript
export function createStaticExecutionWorkflow() {
  const prepareToolsStep = createPrepareToolsStep();

  return createWorkflow({
    stateSchema: executionWorkflowStateSchema,
    inputSchema: z.object({}), // Empty!
    steps: [prepareToolsStep],
  })
    .then(prepareToolsStep)
    .commit();
}
```

### 4. **Usage Example** (`example.ts`)

Shows how to use the workflow:

```typescript
// Create once
const workflow = createStaticExecutionWorkflow();

// Use many times
for (const request of requests) {
  const run = await workflow.createRun();
  const result = await run.start({
    inputData: {},
    initialState: { runId, capabilities, ... }
  });
}
```

## How to Use from Static Folder

```typescript
// In your code
import { createStaticExecutionWorkflow, type ExecutionWorkflowState } from '@mastra/core/loop/workflows/static';

// Create workflow once (e.g., in Agent constructor)
const workflow = createStaticExecutionWorkflow();

// Use for each request
const run = await workflow.createRun({ runId: 'abc-123' });
const result = await run.start({
  inputData: {},
  initialState: {
    capabilities,
    options,
    runId,
    // ... all request data
  },
});
```

## Key Innovation

**Before**: Workflow + steps created every request → closures capture data → memory leak
**After**: Workflow created once → state passed per request → no memory leak

## Ready For

- ✅ Import and use in tests
- ✅ Complete remaining steps (prepareMemory, stream, mapResults)
- ✅ Integrate into Agent class

The foundation is solid and working!
