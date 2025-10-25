# Execution Model Comparison: Inngest vs Workflow

## Why Inngest Integration Works

### Inngest as an Execution Engine

```
┌──────────────────────────────────────────────────────────┐
│ User writes Mastra workflow                              │
│                                                           │
│  const workflow = createWorkflow({...})                  │
│    .then(step1)                                          │
│    .then(step2)                                          │
│    .commit();                                            │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ InngestExecutionEngine.execute()                         │
│                                                           │
│  Translates Mastra graph to Inngest calls:              │
│                                                           │
│  await inngest.step.run('step1', async () => {          │
│    return step1.execute({ inputData });                 │
│  });                                                      │
│                                                           │
│  await inngest.step.run('step2', async () => {          │
│    return step2.execute({ inputData });                 │
│  });                                                      │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ Inngest Service (HTTP API)                               │
│                                                           │
│  - Receives step execution requests                      │
│  - Handles durability, retries, queuing                  │
│  - Returns results                                       │
│  - Compatible with function-based execution              │
└──────────────────────────────────────────────────────────┘
```

**Why it works:**
1. ✅ Inngest exposes an **HTTP API** for workflow execution
2. ✅ Accepts **function calls** as step definitions
3. ✅ Engine can **wrap and delegate** Mastra steps
4. ✅ **Compatible execution model**: functions in, results out
5. ✅ **No code generation** required

## Why Workflow Integration Doesn't Work

### Workflow as an Execution Engine (ATTEMPTED)

```
┌──────────────────────────────────────────────────────────┐
│ User writes Mastra workflow                              │
│                                                           │
│  const workflow = createWorkflow({...})                  │
│    .then(step1)                                          │
│    .parallel([step2, step3])                             │
│    .commit();                                            │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ WorkflowExecutionEngine.execute() ???                    │
│                                                           │
│  Problem: Need to translate Mastra graph to:            │
│                                                           │
│  const workflowCode = `                                  │
│    export async function workflow(input) {              │
│      'use workflow';                                     │
│      const r1 = await step1(input);                     │
│      const [r2, r3] = await Promise.all([               │
│        step2(r1), step3(r1)                             │
│      ]);                                                 │
│      return r3;                                          │
│    }                                                      │
│  `;                                                       │
│                                                           │
│  // How to generate this from execution graph?          │
│  // How to serialize condition/loop closures?           │
│  // How to handle Mastra's state management?            │
└──────────────────────────────────────────────────────────┘
                          ↓ (IMPOSSIBLE)
┌──────────────────────────────────────────────────────────┐
│ Workflow Runtime (VM-based)                              │
│                                                           │
│  - Needs compiled JavaScript CODE STRING                 │
│  - Runs in sandboxed VM context                          │
│  - Deterministic replay from event log                   │
│  - Incompatible with graph-based execution               │
└──────────────────────────────────────────────────────────┘
```

**Why it doesn't work:**
1. ❌ Workflow is a **RUNTIME** (not a service with API)
2. ❌ Requires **pre-compiled JavaScript code** (not graphs)
3. ❌ **VM-based execution** (incompatible with Mastra steps)
4. ❌ Would need **code generator** (complex, fragile)
5. ❌ **Can't serialize** Mastra's closures (conditions, loops)

## Side-by-Side Comparison

### Inngest

| Aspect | Details |
|--------|---------|
| **Type** | External service with HTTP API |
| **Input** | Function calls with data |
| **Execution** | Service orchestrates function execution |
| **Integration** | Wrap Mastra steps, delegate to API |
| **Code Gen** | ❌ Not needed |
| **Feasibility** | ✅ Straightforward |

### Workflow

| Aspect | Details |
|--------|---------|
| **Type** | In-process runtime library |
| **Input** | Compiled JavaScript code string |
| **Execution** | VM executes code with event replay |
| **Integration** | Would need to generate code from graph |
| **Code Gen** | ❌ Required (extremely complex) |
| **Feasibility** | ❌ Not practical |

## Concrete Example

### What Works: Inngest

```typescript
// Mastra workflow definition
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.number(),
})
  .then(step1)
  .then(step2)
  .commit();

// InngestExecutionEngine translates to:
const fn = inngest.createFunction(
  { id: 'workflow.my-workflow' },
  { event: 'workflow.my-workflow' },
  async ({ event, step }) => {
    // Direct function wrapping - works!
    const r1 = await step.run('step1', async () => 
      step1.execute({ inputData: event.data })
    );
    
    const r2 = await step.run('step2', async () => 
      step2.execute({ inputData: r1 })
    );
    
    return r2;
  }
);

// Inngest service executes it ✅
```

### What Doesn't Work: Workflow

```typescript
// Same Mastra workflow definition
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.number(),
})
  .then(step1)
  .then(step2)
  .commit();

// WorkflowExecutionEngine would need to:

// 1. Generate code string from graph (COMPLEX)
const workflowCode = generateCodeFromGraph(workflow.executionGraph);
// Result needs to be:
// `export async function myWorkflow(x) {
//    'use workflow';
//    const r1 = await step1(x);
//    const r2 = await step2(r1);
//    return r2;
//  }`

// 2. Register step functions (COMPLEX)
registerStepFunction('step1', async (input) => 
  step1.execute({ inputData: input })
);

// 3. Execute in VM (INCOMPATIBLE CONTEXT)
const result = await runWorkflow(workflowCode, run, events);
// ❌ Mastra steps expect different context
// ❌ Can't access Mastra instance, RuntimeContext, etc.
// ❌ Different serialization format
```

## What Actually Works: Step-Mode Adapter

Instead of trying to execute Mastra workflows through Workflow's runtime, we use Workflow's compiler output:

```
┌──────────────────────────────────────────────────────────┐
│ Write step logic with Workflow syntax                    │
│                                                           │
│  export async function fetchUser(id) {                   │
│    'use step';                                           │
│    return await db.users.get(id);                        │
│  }                                                        │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ Compile with SWC (step mode)                             │
│                                                           │
│  export async function fetchUser(id) {                   │
│    return await db.users.get(id); // Plain function!     │
│  }                                                        │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ Wrap as Mastra step                                      │
│                                                           │
│  const fetchUserStep = wrapWorkflowStep({                │
│    id: 'fetch-user',                                     │
│    workflowStepFn: fetchUser,                            │
│    inputSchema: z.object({ id: z.string() }),           │
│    outputSchema: z.any(),                                │
│  });                                                      │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ Use in Mastra workflow                                   │
│                                                           │
│  const workflow = createWorkflow({...})                  │
│    .then(fetchUserStep)                                  │
│    .parallel([...])                                      │
│    .commit();                                            │
│                                                           │
│  // Execute with ANY Mastra engine:                      │
│  // - DefaultExecutionEngine                             │
│  // - InngestExecutionEngine                             │
│  // - Custom engine                                      │
└──────────────────────────────────────────────────────────┘
```

**Why this works:**
1. ✅ No code generation needed
2. ✅ No execution model translation
3. ✅ Clean step definitions (Workflow syntax)
4. ✅ Powerful orchestration (Mastra features)
5. ✅ Compatible with all Mastra engines
6. ✅ Type safe and maintainable

## Summary

| Approach | Write Syntax | Execute Through | Feasibility |
|----------|--------------|-----------------|-------------|
| **Inngest Integration** | Mastra | Inngest Service | ✅ Works |
| **Workflow Execution Engine** | Mastra | Workflow Runtime | ❌ Not feasible |
| **Step-Mode Adapter** | Workflow | Mastra Engines | ✅ Works |

**The key insight**: We can't make Workflow execute Mastra workflows, but we CAN make Mastra use Workflow's step definitions. This gives developers the best of both worlds without the impossible translation layer.
