# Workflow Execution Engine Analysis

## Goal

Build a Mastra ExecutionEngine that:
1. Users write workflows using **Mastra's API** (createWorkflow, createStep, etc.)
2. Execution happens through **Workflow's runtime** (VM-based, event log, durability)
3. Similar to how `InngestExecutionEngine` works

## Workflow's Execution Model

After examining the code, here's how Workflow executes:

```typescript
// 1. Start a workflow
await start(myWorkflowFunction, [arg1, arg2]);
// OR
import { myWorkflow } from './workflows/example';
await start(myWorkflow, [arg1, arg2]);

// 2. Workflow runtime does:
async function executeWorkflow(workflowRun, events) {
  // a. Create VM context with fixed timestamp
  const { context, globalThis } = createContext({
    seed: workflowRun.runId,
    fixedTimestamp: workflowRun.startedAt,
  });
  
  // b. Inject useStep function via Symbol
  globalThis[Symbol.for("WORKFLOW_USE_STEP")] = useStep;
  
  // c. Run workflow code in VM
  const workflowFn = runInContext(workflowCode, context);
  
  // d. Execute with deterministic replay from events
  const result = await workflowFn(...args);
  
  return result;
}
```

## Key Requirements for Workflow Runtime

1. **Compiled Workflow Code**: Needs JavaScript code string to execute in VM
   ```typescript
   const workflowCode = `
     export async function myWorkflow(x) {
       const result = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step1")(x);
       return result;
     }
   `;
   ```

2. **WorkflowId Metadata**: Function needs `workflowId` property
   ```typescript
   myWorkflow.workflowId = "workflow//file.ts//myWorkflow";
   ```

3. **Event Log**: Steps resolved from event log during replay
   - `step_started` events
   - `step_completed` events  
   - `step_failed` events

4. **World Interface**: Storage, queuing, auth abstraction
   ```typescript
   const world = getWorld(); // Returns World interface
   await world.runs.create({ workflowName, input });
   await world.queue(`__wkf_workflow_${workflowName}`, payload);
   ```

## Challenge: Mastra → Workflow Translation

### Problem 1: Code Generation

Mastra workflows are **runtime objects** (execution graphs):

```typescript
const workflow = createWorkflow({...})
  .then(step1)
  .then(step2)
  .parallel([step3, step4])
  .commit();
```

Workflow needs **compiled JavaScript code**:

```typescript
// Need to generate this:
export async function workflow(input) {
  'use workflow';
  const r1 = await step1(input);
  const r2 = await step2(r1);
  const [r3, r4] = await Promise.all([
    step3(r2),
    step4(r2),
  ]);
  return r4;
}
```

**This requires a code generator** that:
- Traverses Mastra's execution graph
- Generates equivalent JavaScript code
- Handles all Mastra patterns (parallel, conditional, loops, foreach, etc.)
- Maintains proper data flow and variable passing

### Problem 2: Step Function Transformation

Mastra steps are objects with execute functions:

```typescript
const step1 = createStep({
  id: 'step1',
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.number(),
  execute: async ({ inputData }) => {
    return inputData.x * 2;
  },
});
```

Workflow expects step functions to be:
1. Registered in the step registry
2. Called via `useStep` 
3. Resolved from event log during replay

We'd need to:
- Extract execute logic from Mastra steps
- Register as Workflow step functions
- Generate calls to them in workflow code

### Problem 3: Semantic Differences

| Feature | Mastra | Workflow |
|---------|--------|----------|
| **State** | Explicit state object | VM memory (automatic) |
| **Data Flow** | Map/variable references | Direct variable passing |
| **Suspend/Resume** | Suspend points with schemas | Event log replay |
| **Loops** | dountil/dowhile with conditions | While/for loops in code |
| **Conditionals** | Branch with condition functions | If/else in code |
| **Foreach** | Foreach with concurrency | For loop + Promise.all |

Example - Mastra conditional:

```typescript
workflow
  .branch([
    [async ({ inputData }) => inputData.score > 80, highScoreStep],
    [async ({ inputData }) => inputData.score > 50, mediumScoreStep],
  ])
```

Would need to generate:

```typescript
export async function workflow(input) {
  'use workflow';
  if (input.score > 80) {
    return await highScoreStep(input);
  } else if (input.score > 50) {
    return await mediumScoreStep(input);
  }
}
```

But the condition functions are runtime closures - can't serialize them!

### Problem 4: Execution Context Mismatch

**Mastra's ExecutionEngine interface expects**:
```typescript
interface ExecutionEngine {
  execute<TState, TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    graph: ExecutionGraph;  // ← Mastra's graph structure
    input?: TInput;
    initialState?: TState;
    emitter: Emitter;
    // ... execute the graph
  }): Promise<TOutput>;
}
```

**Workflow's runtime expects**:
```typescript
// Workflow code as string
const workflowCode = "export async function myWorkflow() { ... }";

// Execute in VM
const result = await runWorkflow(
  workflowCode,     // ← Code string, not graph
  workflowRun,      // ← World storage record
  events            // ← Event log for replay
);
```

These are fundamentally different interfaces.

### Problem 5: Runtime Dependencies

Workflow runtime has implicit dependencies:
- VM context with seeded Math.random()
- Fixed timestamps
- Symbol-based global injection
- Specific serialization format
- Event log structure

Mastra steps expect:
- Full Node.js context
- RuntimeContext for dependency injection
- Mastra instance
- Tracing context
- Different serialization

## Feasibility Assessment

### ❌ Direct Execution Engine: NOT FEASIBLE

Building a traditional `WorkflowExecutionEngine` like `InngestExecutionEngine` is **not feasible** because:

1. **No execution API**: Workflow doesn't expose a "run this graph" API
2. **Code generation required**: Would need to compile Mastra graphs to JavaScript
3. **Semantic mismatches**: Different execution models (graph vs VM)
4. **Context incompatibility**: Different runtime expectations
5. **Closure serialization**: Can't serialize Mastra's condition/loop functions

This is fundamentally different from Inngest, which:
- ✅ Has an HTTP API to execute workflows
- ✅ Accepts step definitions as data
- ✅ Has compatible execution model
- ✅ Can wrap Mastra steps directly

### ⚠️ Hybrid Approach: EXTREMELY COMPLEX

Could theoretically:
1. Generate Workflow code from Mastra execution graph
2. Register Mastra step execute functions as Workflow steps
3. Wire up event emitters
4. Translate between execution models

But this would be:
- ❌ **Extremely fragile**: Any Mastra feature change breaks it
- ❌ **Incomplete**: Can't support all Mastra patterns (closures, dynamic state, etc.)
- ❌ **Performance overhead**: Multiple translation layers
- ❌ **Debugging nightmare**: Stack traces through generated code
- ❌ **Maintenance burden**: Two execution models to support

### ✅ Alternative: Step-Mode Adapter (Already Built)

The feasible approach is what we already built:
1. Write steps with Workflow syntax (`"use step"`)
2. Compile to plain functions (step mode)
3. Wrap as Mastra steps
4. **Execute with Mastra's engines** (not Workflow's)

This gives:
- ✅ Clean step definitions
- ✅ Mastra orchestration
- ✅ Mastra execution engines
- ✅ No translation layer
- ✅ Maintainable

## Why Inngest Works But Workflow Doesn't

### Inngest Architecture

```typescript
// Inngest is a SERVICE with an API
class InngestExecutionEngine {
  async executeStep({ step, input }) {
    // HTTP call to Inngest API
    await inngest.step.run(step.id, async () => {
      return step.execute({ inputData: input });
    });
  }
}
```

**Key characteristics:**
- ✅ HTTP API for workflow execution
- ✅ Steps are functions you pass to their API
- ✅ Service handles orchestration
- ✅ Compatible execution model
- ✅ No code generation needed

### Workflow Architecture

```typescript
// Workflow is a RUNTIME, not a service
function runWorkflow(code, run, events) {
  // Needs compiled JavaScript code
  const vm = createContext();
  const fn = runInContext(code, vm);
  return fn(...args);
}
```

**Key characteristics:**
- ❌ No HTTP API, it's a runtime library
- ❌ Needs pre-compiled JavaScript code
- ❌ VM-based execution
- ❌ Incompatible with graph-based execution
- ❌ Would require code generation

## Recommendation

### ❌ Don't Build: WorkflowExecutionEngine

**Do not attempt** to build a traditional execution engine that runs Mastra workflows through Workflow's runtime. The architectural differences are too fundamental.

### ✅ Already Built: Step-Mode Adapter  

The **step-mode adapter** (`workflows/workflow-adapter/`) is the right approach:

```typescript
// 1. Write steps with Workflow syntax
export async function fetchUser(id) {
  'use step';
  return await db.users.get(id);
}

// 2. Compile to plain functions
// 3. Wrap as Mastra steps
// 4. Execute with Mastra's engines (including Inngest!)

const workflow = createWorkflow({...})
  .then(wrappedFetchUser)
  .commit();

// Execute with Inngest engine
const inngestWorkflow = InngestWorkflow({...});
```

This approach:
- ✅ Works today
- ✅ No code generation
- ✅ No semantic translation
- ✅ Maintainable
- ✅ Best of both worlds

### 🤔 Possible Future: Workflow as World Backend

One possible future direction:

**Instead of using Workflow's runtime**, use Workflow's **World interface** as a storage backend for Mastra:

```typescript
// Use Workflow's storage, not its runtime
class WorkflowStorageAdapter implements MastraStorage {
  private world: World;
  
  constructor() {
    this.world = getWorld(); // Workflow's World interface
  }
  
  async persistWorkflowSnapshot({ workflowName, runId, snapshot }) {
    // Store Mastra snapshots using Workflow's storage
    await this.world.runs.create({...});
    await this.world.events.create({...});
  }
  
  // ... implement other MastraStorage methods
}

// Use in Mastra
const mastra = new Mastra({
  storage: new WorkflowStorageAdapter(),
  workflows: { myWorkflow },
});
```

**Benefits:**
- ✅ Use Workflow's storage infrastructure
- ✅ Keep Mastra's execution model
- ✅ No code generation needed
- ✅ Leverage Workflow's World implementations (Vercel, local, etc.)

**This would be feasible** and might be interesting to explore.

## Summary

| Approach | Feasibility | Effort | Value |
|----------|-------------|--------|-------|
| Workflow Execution Engine | ❌ Not Feasible | Extremely High | Negative (fragile) |
| Step-Mode Adapter | ✅ Done | Low (already built) | High |
| Workflow Storage Backend | 🤔 Potentially Feasible | Medium | Medium-High |

**Recommendation**: Stick with the step-mode adapter and potentially explore using Workflow's World interface as a storage backend in the future.
