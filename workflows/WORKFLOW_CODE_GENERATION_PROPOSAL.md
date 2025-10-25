# Workflow Execution Engine via Code Generation

## Understanding the Request

You want:
1. **Write**: Mastra workflow syntax (createWorkflow, .then(), etc.)
2. **Execute**: Through Workflow's runtime (VM-based, event log durability)

This requires **generating code** from Mastra's execution graph, similar to how:
- **DefaultExecutionEngine**: Directly executes the graph
- **InngestExecutionEngine**: Wraps execution in Inngest API calls
- **WorkflowExecutionEngine**: Generates code and runs in Workflow's VM

## How Mastra ExecutionEngines Work

### DefaultExecutionEngine Pattern

```typescript
// User writes:
const workflow = createWorkflow({...})
  .then(step1)
  .then(step2)
  .commit();

// Produces execution graph:
{
  id: 'workflow',
  steps: [
    { type: 'step', step: step1 },
    { type: 'step', step: step2 },
  ]
}

// DefaultExecutionEngine executes:
async execute({ graph, input }) {
  for (let entry of graph.steps) {
    if (entry.type === 'step') {
      result = await entry.step.execute({ inputData: input });
      input = result;
    }
  }
  return result;
}
```

### InngestExecutionEngine Pattern

```typescript
// Same Mastra workflow
const workflow = createWorkflow({...})
  .then(step1)
  .then(step2)
  .commit();

// InngestExecutionEngine wraps in Inngest API:
async execute({ graph, input }) {
  let result = input;
  for (let entry of graph.steps) {
    if (entry.type === 'step') {
      result = await inngest.step.run(entry.step.id, async () => {
        return await entry.step.execute({ inputData: result });
      });
    }
  }
  return result;
}
```

### WorkflowExecutionEngine Pattern (Proposed)

```typescript
// Same Mastra workflow  
const workflow = createWorkflow({...})
  .then(step1)
  .then(step2)
  .parallel([step3, step4])
  .commit();

// WorkflowExecutionEngine generates code:
class WorkflowExecutionEngine extends ExecutionEngine {
  async execute({ graph, input }) {
    // 1. Generate JavaScript code from graph
    const code = this.generateWorkflowCode(graph);
    // Result:
    // `
    //   export async function mastra_workflow_${workflowId}(input) {
    //     const r1 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step1")(input);
    //     const r2 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step2")(r1);
    //     const [r3, r4] = await Promise.all([
    //       globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step3")(r2),
    //       globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step4")(r2)
    //     ]);
    //     return r4;
    //   }
    // `
    
    // 2. Register Mastra steps as Workflow step functions
    this.registerMastraSteps(graph.steps);
    
    // 3. Execute through Workflow runtime
    const result = await runWorkflowWithCode(code, input);
    
    return result;
  }
  
  private generateWorkflowCode(graph: ExecutionGraph): string {
    // Generate JavaScript code from execution graph
    // ...
  }
}
```

## Code Generation Strategy

### Example 1: Sequential Steps

**Mastra Input:**
```typescript
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.object({ result: z.number() }),
})
  .then(step1)
  .then(step2)
  .then(step3)
  .commit();
```

**Generated Code:**
```javascript
export async function mastra_workflow_my_workflow(input) {
  const r_step1 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step1")(input);
  const r_step2 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step2")(r_step1);
  const r_step3 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step3")(r_step2);
  return r_step3;
}
```

### Example 2: Parallel Steps

**Mastra Input:**
```typescript
const workflow = createWorkflow({...})
  .then(fetchUser)
  .parallel([sendEmail, sendSMS, sendSlack])
  .commit();
```

**Generated Code:**
```javascript
export async function mastra_workflow_notifications(input) {
  const r_fetchUser = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("fetchUser")(input);
  
  const [r_sendEmail, r_sendSMS, r_sendSlack] = await Promise.all([
    globalThis[Symbol.for("WORKFLOW_USE_STEP")]("sendEmail")(r_fetchUser),
    globalThis[Symbol.for("WORKFLOW_USE_STEP")]("sendSMS")(r_fetchUser),
    globalThis[Symbol.for("WORKFLOW_USE_STEP")]("sendSlack")(r_fetchUser),
  ]);
  
  return { sendEmail: r_sendEmail, sendSMS: r_sendSMS, sendSlack: r_sendSlack };
}
```

### Example 3: Conditional (Branch)

**Mastra Input:**
```typescript
const workflow = createWorkflow({...})
  .then(checkScore)
  .branch([
    [async ({ inputData }) => inputData.score > 80, highScoreStep],
    [async ({ inputData }) => inputData.score > 50, mediumScoreStep],
    [async () => true, lowScoreStep],
  ])
  .commit();
```

**Generated Code (THE PROBLEM):**
```javascript
export async function mastra_workflow_scoring(input) {
  const r_checkScore = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("checkScore")(input);
  
  // ❌ PROBLEM: How to generate this from runtime closures?
  let result;
  if (r_checkScore.score > 80) {
    result = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("highScoreStep")(r_checkScore);
  } else if (r_checkScore.score > 50) {
    result = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("mediumScoreStep")(r_checkScore);
  } else {
    result = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("lowScoreStep")(r_checkScore);
  }
  
  return result;
}
```

**The problem**: Condition functions are closures at runtime, not serializable code.

### Example 4: Loop (Dountil)

**Mastra Input:**
```typescript
const workflow = createWorkflow({...})
  .dountil(
    incrementStep,
    async ({ inputData }) => inputData.value >= 10
  )
  .commit();
```

**Generated Code (THE PROBLEM):**
```javascript
export async function mastra_workflow_loop(input) {
  let result = input;
  
  // ❌ PROBLEM: How to generate loop condition from runtime closure?
  do {
    result = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("incrementStep")(result);
  } while (result.value < 10);  // How to extract this from the closure?
  
  return result;
}
```

## Feasibility Analysis

### ✅ FEASIBLE: Simple Patterns

Can generate code for:
- ✅ Sequential steps (`.then()`)
- ✅ Parallel steps (`.parallel()`)
- ✅ Foreach (with static concurrency)
- ✅ Sleep (with static duration)
- ✅ Map (with static mappings)

### ❌ PROBLEMATIC: Dynamic Patterns

Cannot reliably generate code for:
- ❌ **Conditionals** with runtime closures
- ❌ **Loops** with runtime condition functions
- ❌ **Dynamic sleep** (duration from function)
- ❌ **Dynamic map** (mapping from function)

These use JavaScript functions that can't be serialized to code strings.

## Proposed Solution: Hybrid Approach

### Option 1: Limited Code Generation (Partial Support)

Support only the patterns that CAN be code-generated:

```typescript
class WorkflowExecutionEngine extends ExecutionEngine {
  async execute({ graph, input }) {
    // Validate graph only has supported patterns
    this.validateGraphSupported(graph);
    
    // Generate code
    const code = this.generateCode(graph);
    
    // Register steps
    for (let entry of graph.steps) {
      if (entry.type === 'step') {
        registerStepFunction(entry.step.id, async (...args) => {
          return entry.step.execute({ inputData: args[0] });
        });
      }
    }
    
    // Execute through Workflow runtime
    return await runWorkflowCode(code, input);
  }
  
  private validateGraphSupported(graph) {
    for (let entry of graph.steps) {
      if (entry.type === 'conditional' || entry.type === 'loop') {
        throw new Error(
          'WorkflowExecutionEngine does not support conditional or loop ' +
          'patterns with runtime closures. Use sequential and parallel only.'
        );
      }
    }
  }
}
```

**Supported workflow:**
```typescript
// ✅ This works
const workflow = createWorkflow({...})
  .then(step1)
  .parallel([step2, step3])
  .then(step4)
  .commit();
```

**Unsupported workflow:**
```typescript
// ❌ This throws error
const workflow = createWorkflow({...})
  .branch([
    [async ({ inputData }) => inputData.x > 5, stepA],
    [async () => true, stepB],
  ])
  .commit();
```

### Option 2: AST Serialization (Complex)

Serialize condition/loop functions as AST and regenerate:

```typescript
// Mastra code
.branch([
  [async ({ inputData }) => inputData.score > 80, highStep],
])

// Serialize to AST representation
{
  type: 'BinaryExpression',
  operator: '>',
  left: { type: 'MemberExpression', object: 'inputData', property: 'score' },
  right: { type: 'NumericLiteral', value: 80 }
}

// Regenerate as code
"r_checkScore.score > 80"
```

**Problems:**
- Complex to implement reliably
- Hard to maintain
- Doesn't work for complex closures
- Fragile with scope/binding

### Option 3: Pre-transform Required (Recommended)

Require users to write Workflow-compatible code upfront:

```typescript
// Instead of closures, use string templates
const workflow = createWorkflow({...})
  .branchWithCode([
    ["inputData.score > 80", highScoreStep],
    ["inputData.score > 50", mediumScoreStep],
  ])
  .commit();

// Or use a special builder
const workflow = createWorkflow({...})
  .branchDSL([
    [{ field: 'score', op: '>', value: 80 }, highScoreStep],
    [{ field: 'score', op: '>', value: 50 }, mediumScoreStep],
  ])
  .commit();
```

This can be code-generated reliably.

## Implementation Sketch

```typescript
// workflows/workflow-engine/index.ts
import { ExecutionEngine } from '@mastra/core/workflows';
import type { ExecutionGraph, StepFlowEntry } from '@mastra/core/workflows';
import { getStepFunction, registerStepFunction } from '@workflow/core/private';
import { runWorkflow } from '@workflow/core/workflow';
import { getWorld } from '@workflow/core/runtime';

export class WorkflowExecutionEngine extends ExecutionEngine {
  async execute<TState, TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    graph: ExecutionGraph;
    input?: TInput;
    // ... other params
  }): Promise<TOutput> {
    const { graph, input, workflowId, runId } = params;
    
    // Step 1: Validate graph is code-generable
    this.validateGraph(graph);
    
    // Step 2: Generate workflow code from graph
    const generatedCode = this.generateWorkflowCode(graph, workflowId);
    
    // Step 3: Register Mastra steps as Workflow step functions
    this.registerSteps(graph.steps, params);
    
    // Step 4: Create Workflow run
    const world = getWorld();
    const workflowRun = await world.runs.create({
      deploymentId: await world.getDeploymentId(),
      workflowName: `mastra_${workflowId}`,
      input: [input],
    });
    
    // Step 5: Get events for replay
    const events = await world.events.list({ runId: workflowRun.runId });
    
    // Step 6: Execute through Workflow runtime
    const result = await runWorkflow(generatedCode, workflowRun, events.items);
    
    return {
      status: 'success',
      result,
      steps: {}, // Would need to map from Workflow's event log
    } as TOutput;
  }
  
  private generateWorkflowCode(graph: ExecutionGraph, workflowId: string): string {
    let code = `export async function mastra_${workflowId}(input) {\n`;
    let lastVar = 'input';
    
    for (let i = 0; i < graph.steps.length; i++) {
      const entry = graph.steps[i];
      const varName = `r_${i}`;
      
      if (entry.type === 'step') {
        code += `  const ${varName} = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("${entry.step.id}")(${lastVar});\n`;
        lastVar = varName;
      } else if (entry.type === 'parallel') {
        const stepVars = entry.steps.map((s, j) => `r_${i}_${j}`);
        const calls = entry.steps.map((s, j) => {
          if (s.type === 'step') {
            return `globalThis[Symbol.for("WORKFLOW_USE_STEP")]("${s.step.id}")(${lastVar})`;
          }
          return 'Promise.resolve(null)';
        });
        code += `  const [${stepVars.join(', ')}] = await Promise.all([\n`;
        code += calls.map(c => `    ${c}`).join(',\n') + '\n  ]);\n';
        code += `  const ${varName} = { ${stepVars.map((v, j) => `"${entry.steps[j].step.id}": ${v}`).join(', ')} };\n`;
        lastVar = varName;
      }
      // ... handle other entry types
    }
    
    code += `  return ${lastVar};\n}`;
    return code;
  }
  
  private registerSteps(steps: StepFlowEntry[], params: any) {
    for (let entry of steps) {
      if (entry.type === 'step') {
        registerStepFunction(entry.step.id, async (input: any) => {
          // Execute Mastra step with Workflow-compatible context
          return await entry.step.execute({
            inputData: input,
            mastra: this.mastra,
            runtimeContext: params.runtimeContext,
            // ... map other context
          });
        });
      } else if (entry.type === 'parallel' || entry.type === 'conditional') {
        this.registerSteps(entry.steps, params);
      }
    }
  }
  
  private validateGraph(graph: ExecutionGraph) {
    for (let entry of graph.steps) {
      if (entry.type === 'conditional') {
        throw new Error(
          'WorkflowExecutionEngine does not support .branch() with runtime closures. ' +
          'Use .branchWithCode() or switch to DefaultExecutionEngine.'
        );
      }
      if (entry.type === 'loop') {
        throw new Error(
          'WorkflowExecutionEngine does not support .dountil()/.dowhile() with runtime closures. ' +
          'Use .loopWithCode() or switch to DefaultExecutionEngine.'
        );
      }
    }
  }
}
```

## Complete Example

```typescript
// User code
import { createWorkflow, createStep } from '@mastra/workflows';
import { WorkflowExecutionEngine } from '@mastra/workflow-engine';
import { z } from 'zod';

const step1 = createStep({
  id: 'double',
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.object({ x: z.number() }),
  execute: async ({ inputData }) => ({
    x: inputData.x * 2
  }),
});

const step2 = createStep({
  id: 'add-ten',
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.object({ x: z.number() }),
  execute: async ({ inputData }) => ({
    x: inputData.x + 10
  }),
});

// Create workflow with Workflow execution engine
const workflow = createWorkflow({
  id: 'math-workflow',
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.object({ x: z.number() }),
  executionEngine: new WorkflowExecutionEngine({
    mastra,
    options: { validateInputs: true, shouldPersistSnapshot: () => true },
  }),
})
  .then(step1)
  .then(step2)
  .commit();

// Execute - runs through Workflow's VM runtime
const run = await workflow.createRunAsync();
const result = await run.start({ inputData: { x: 5 } });
// Result: { x: 20 } via Workflow's durable runtime
```

## Benefits

### ✅ What You Get

1. **Mastra syntax** - Users write familiar Mastra workflows
2. **Workflow runtime** - Execution through Workflow's VM (durability, event log)
3. **Type safety** - Full TypeScript + Zod validation
4. **Durability** - Workflow's deterministic replay
5. **Isolation** - Workflow's VM sandboxing

### ⚠️ Limitations

1. **No runtime closures** - Can't use `.branch()` or `.dountil()` with functions
2. **Limited patterns** - Only sequential, parallel, foreach, static sleep
3. **Code generation complexity** - Adds complexity and potential bugs
4. **Different semantics** - Workflow's VM != Mastra's execution context

## Comparison with Alternatives

| Approach | Write Syntax | Execute Through | Patterns Supported | Complexity |
|----------|--------------|-----------------|-------------------|------------|
| **WorkflowExecutionEngine** | Mastra | Workflow Runtime | ⚠️ Partial (no closures) | 🔴 High |
| **Step-Mode Adapter** | Workflow | Mastra Engines | ✅ All Mastra patterns | 🟢 Low |
| **DefaultExecutionEngine** | Mastra | Direct | ✅ All Mastra patterns | 🟢 Low |
| **InngestExecutionEngine** | Mastra | Inngest API | ✅ All Mastra patterns | 🟡 Medium |

## Recommendation

### If You Want Workflow's Runtime Features

Write workflows using Workflow's native syntax:
```typescript
export async function myWorkflow(input) {
  'use workflow';
  const r1 = await step1(input);
  const r2 = await step2(r1);
  return r2;
}
```

**Benefits:**
- ✅ Full Workflow features (VM, deterministic replay)
- ✅ No code generation needed
- ✅ Clean and simple

### If You Want Mastra's Orchestration

Use the step-mode adapter:
```typescript
// Write steps with Workflow syntax
export async function step1(x) {
  'use step';
  return x * 2;
}

// Orchestrate with Mastra
const workflow = createWorkflow({...})
  .then(wrappedStep1)
  .branch([...])  // ✅ Full Mastra features
  .commit();
```

**Benefits:**
- ✅ All Mastra patterns (closures work!)
- ✅ All Mastra engines (Inngest, etc.)
- ✅ No code generation
- ✅ Maintainable

### If You REALLY Want Both

Build `WorkflowExecutionEngine` with explicit limitations:

```typescript
const workflow = createWorkflow({
  id: 'my-workflow',
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .then(step1)
  .parallel([step2, step3])
  // NO .branch() or .dountil() - would throw error
  .commit();
```

**This is feasible** but requires:
1. Code generator implementation
2. Clear documentation of limitations
3. Good error messages for unsupported patterns
4. Maintenance of code generation logic

## Next Steps

Let me know which direction you want to pursue:

1. **Build WorkflowExecutionEngine** with limitations (sequential, parallel only)
2. **Enhance step-mode adapter** with better DX
3. **Explore Workflow World** as storage backend
4. **Document** side-by-side usage

I can implement whichever you prefer!
