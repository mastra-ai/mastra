# Static Execution Workflow

This directory contains a **static, reusable workflow** for agent execution that prevents memory leaks.

## Problem

The previous implementation recreated the entire workflow on every `agent.stream()` or `agent.generate()` call:

```typescript
// ❌ OLD: Creates new workflow + steps + closures every time
async #execute(options) {
  const executionWorkflow = createPrepareStreamWorkflow({
    capabilities,
    options,
    runId,
    memory,
    // ... all request-specific data captured in closures
  });

  const run = await executionWorkflow.createRun();
  return await run.start();
}
```

Each workflow creation allocated:

- 4 new step instances
- Closures capturing request-specific data
- Execution graph structures
- Internal Maps and state

**This caused memory leaks** as closures kept request data in memory even after execution completed.

## Solution

Create the workflow **once** and pass request-specific data via **workflow state**:

```typescript
// ✅ NEW: Create workflow once, reuse forever
#executionWorkflow = createStaticExecutionWorkflow(); // Created once

async #execute(options) {
  const run = await this.#executionWorkflow.createRun();

  // Pass ALL request data via state, not closures
  return await run.start({
    inputData: {},
    initialState: {
      capabilities,
      options,
      runId,
      memory,
      // ... all request-specific data
    }
  });
}
```

## Architecture

### State Schema (`schema.ts`)

Defines all request-specific data that steps need:

- `capabilities`: Agent methods (convertTools, getMemory, etc.)
- `options`: Execution options (toolsets, maxSteps, etc.)
- `runId`, `threadFromArgs`, `resourceId`: Request identifiers
- `memory`, `memoryConfig`: Memory configuration
- `instructions`: System message
- etc.

### Steps

Each step accesses data from `state` instead of closures:

```typescript
export function createPrepareToolsStep() {
  return createStep({
    id: 'prepare-tools-step',
    stateSchema: executionWorkflowStateSchema,
    execute: async ({ state }) => {
      // Access from state ✅ not from closure ❌
      const { capabilities, options, runId } = state;
      // ... step logic
    },
  });
}
```

### Workflow (`index.ts`)

Exports `createStaticExecutionWorkflow()` that wires up all steps without any request-specific data.

## Current Status

- [x] State schema defined
- [x] `prepareToolsStep` refactored
- [x] `prepareMemoryStep` refactored
- [x] `streamStep` refactored
- [x] `mapResultsStep` refactored
- [x] Complete workflow wired and committed
- [ ] Integration with Agent class (TODO)

## Benefits

1. **No Memory Leaks**: Workflow created once, no closures capturing request data
2. **Better Performance**: No overhead recreating workflow structures
3. **Cleaner Architecture**: Clear separation between workflow structure and execution data
4. **Reusable**: Same workflow for all agent requests
5. **Type-Safe**: State schema provides type safety for all steps

## Next Steps

1. Refactor remaining steps to use state
2. Wire up complete workflow graph
3. Add workflow field to Agent class
4. Update Agent#execute to use static workflow
5. Test memory usage before/after
