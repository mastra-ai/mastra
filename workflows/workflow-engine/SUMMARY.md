# WorkflowExecutionEngine: Final Analysis

## Your Request

> "I want the user to write Mastra workflows but when the workflow is executed it's executed through the workflow packages execution"

This means:
- **Write**: Mastra syntax (`createWorkflow().then().parallel()`)
- **Execute**: Through Workflow's runtime (VM-based, event log durability)

## How It Would Work

### Architecture

```
User Code (Mastra Syntax)
    ↓
Mastra Execution Graph
    ↓
WorkflowExecutionEngine.execute()
    ↓
Code Generator (graph → JavaScript string)
    ↓
Register Mastra Steps as Workflow Functions
    ↓
Workflow Runtime (VM execution)
    ↓
Result
```

### Code Generation Example

**Input (Mastra):**
```typescript
const workflow = createWorkflow({
  id: 'my-workflow',
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .then(step1)
  .parallel([step2, step3])
  .then(step4)
  .commit();
```

**Generated Code:**
```javascript
export async function mastra_my_workflow(input) {
  const r_0 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step1")(input);
  const [r_1_0, r_1_1] = await Promise.all([
    globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step2")(r_0),
    globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step3")(r_0),
  ]);
  const r_1 = { "step2": r_1_0, "step3": r_1_1 };
  const r_2 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step4")(r_1);
  return r_2;
}
```

**Step Registration:**
```typescript
// For each Mastra step, register with Workflow runtime
registerStepFunction("step1", async (input) => {
  return await mastraStep1.execute({ 
    inputData: input,
    mastra,
    runtimeContext,
    // ... full Mastra context
  });
});
```

**Execution:**
```typescript
const result = await runWorkflow(generatedCode, input);
```

## What Works ✅

Code generation **IS FEASIBLE** for:

1. **Sequential steps** (`.then()`)
   ```typescript
   .then(step1).then(step2).then(step3)
   ```

2. **Parallel steps** (`.parallel()`)
   ```typescript
   .parallel([step1, step2, step3])
   ```

3. **Foreach** (`.foreach()` with static concurrency)
   ```typescript
   .foreach(processItem, { concurrency: 3 })
   ```

4. **Static sleep** (`.sleep()` with fixed duration)
   ```typescript
   .sleep(5000)
   ```

5. **Map** (`.map()` with static transformation)
   ```typescript
   .map(({ stepResults }) => stepResults.data)
   ```

## What Doesn't Work ❌

Code generation **IS NOT FEASIBLE** for:

1. **Conditional branches** (`.branch()` with closures)
   ```typescript
   // ❌ Cannot serialize this function
   .branch([
     [async ({ inputData }) => inputData.score > 80, highStep],
     [async () => true, lowStep],
   ])
   ```
   
   **Problem**: Condition functions are runtime closures, not serializable.

2. **Loops** (`.dountil()`, `.dowhile()` with closures)
   ```typescript
   // ❌ Cannot serialize this function
   .dountil(
     incrementStep,
     async ({ inputData }) => inputData.value >= 10
   )
   ```
   
   **Problem**: Loop conditions are runtime closures.

3. **Dynamic sleep** (`.sleep()` with function)
   ```typescript
   // ❌ Cannot serialize this function
   .sleep(async ({ inputData }) => inputData.delayMs)
   ```
   
   **Problem**: Duration from closure can't be extracted.

4. **Dynamic map** (`.map()` with function)
   ```typescript
   // ❌ Cannot serialize this function
   .map(async ({ stepResults }) => {
     return complexTransform(stepResults);
   })
   ```
   
   **Problem**: Transformation logic in closure.

## Why Closures Are The Problem

JavaScript functions can capture variables from outer scopes (closures):

```typescript
const threshold = 100;
const workflow = createWorkflow({...})
  .branch([
    // This captures 'threshold' from outer scope
    [async ({ inputData }) => inputData.value > threshold, stepA],
  ]);
```

To generate code, we'd need to:
1. Extract the function body as string
2. Identify all captured variables
3. Serialize their values
4. Recreate the scope in generated code

This is:
- **Complex**: Requires AST parsing, scope analysis
- **Fragile**: Breaks with complex closures
- **Limited**: Can't serialize functions, complex objects
- **Unmaintainable**: Hard to debug and maintain

## Possible Solutions

### Solution 1: Partial Support (Recommended)

Support only patterns that CAN be code-generated:

```typescript
class WorkflowExecutionEngine extends ExecutionEngine {
  async execute({ graph }) {
    // Validate: only sequential, parallel, foreach, static sleep
    this.validateGraph(graph);
    
    // Generate and execute
    const code = this.generateCode(graph);
    return await runWorkflow(code, input);
  }
  
  validateGraph(graph) {
    for (let entry of graph.steps) {
      if (entry.type === 'conditional' || entry.type === 'loop') {
        throw new Error(
          'WorkflowExecutionEngine does not support .branch() or loops.\n' +
          'Use DefaultExecutionEngine for these features.'
        );
      }
    }
  }
}
```

**Pros:**
- ✅ Clean, simple implementation
- ✅ Clear limitations
- ✅ Maintainable

**Cons:**
- ❌ Limited to subset of Mastra features
- ❌ Confusing for users (some methods work, others don't)

### Solution 2: AST Serialization (Complex)

Parse and serialize closure functions:

```typescript
// User code
.branch([
  [async ({ inputData }) => inputData.score > 80, stepA]
])

// Parse to AST
{
  type: 'BinaryExpression',
  operator: '>',
  left: { type: 'Member', path: ['inputData', 'score'] },
  right: { type: 'Literal', value: 80 }
}

// Generate code
"input.score > 80"
```

**Pros:**
- ✅ Could support more patterns

**Cons:**
- ❌ Very complex to implement correctly
- ❌ Fragile with scope and binding
- ❌ Hard to maintain
- ❌ Limited to simple expressions

### Solution 3: DSL Alternative (New API)

Add new methods that take serializable config:

```typescript
// Instead of closure
.branch([
  [async ({ inputData }) => inputData.score > 80, stepA]
])

// Use DSL
.branchOn('score', [
  [{ op: '>', value: 80 }, stepA],
  [{ op: '>', value: 50 }, stepB],
])
```

**Pros:**
- ✅ Serializable
- ✅ Code-generable
- ✅ Clear intent

**Cons:**
- ❌ Different API from standard Mastra
- ❌ Less flexible than closures
- ❌ More methods to learn/maintain

### Solution 4: Don't Build It (Use Alternatives)

#### Option A: Step-Mode Adapter (Already Built!)

Use Workflow for steps, Mastra for orchestration:

```typescript
// Write steps with Workflow
export async function step1(x) {
  'use step';
  return x * 2;
}

// Wrap and orchestrate with Mastra
const workflow = createWorkflow({...})
  .then(wrappedStep1)
  .branch([...])  // ✅ Full Mastra features work!
  .commit();
```

**Pros:**
- ✅ All Mastra patterns work (closures, everything)
- ✅ Clean Workflow step functions
- ✅ Already implemented
- ✅ Maintainable

**Cons:**
- ❌ Orchestration runs in Mastra, not Workflow runtime
- ❌ No Workflow durability features

#### Option B: Write Native Workflow Code

Skip Mastra orchestration, use Workflow directly:

```typescript
export async function myWorkflow(input) {
  'use workflow';
  const r1 = await step1(input);
  if (r1.score > 80) {
    return await highStep(r1);
  }
  return await lowStep(r1);
}
```

**Pros:**
- ✅ Full Workflow features (VM, durability)
- ✅ Natural JavaScript syntax
- ✅ No limitations

**Cons:**
- ❌ Can't use Mastra's orchestration features
- ❌ Can't use Mastra's execution engines (Inngest, etc.)

## Comparison Table

| Feature | WorkflowExecEngine | Step-Mode Adapter | Native Workflow | DefaultEngine |
|---------|-------------------|-------------------|-----------------|---------------|
| **Write Syntax** | Mastra | Workflow steps + Mastra orchestration | Workflow | Mastra |
| **Execute Through** | Workflow Runtime | Mastra Engines | Workflow Runtime | Direct |
| **Sequential Steps** | ✅ | ✅ | ✅ | ✅ |
| **Parallel Steps** | ✅ | ✅ | ✅ | ✅ |
| **Conditional (branch)** | ❌ Closures | ✅ | ✅ | ✅ |
| **Loops (dountil)** | ❌ Closures | ✅ | ✅ | ✅ |
| **Foreach** | ✅ Static | ✅ | ✅ | ✅ |
| **Dynamic sleep** | ❌ Function | ✅ | ✅ | ✅ |
| **Workflow VM** | ✅ | ❌ | ✅ | ❌ |
| **Workflow Durability** | ✅ | ❌ | ✅ | ❌ |
| **Mastra Engines (Inngest)** | ❌ | ✅ | ❌ | ✅ |
| **Implementation Complexity** | 🔴 High | 🟢 Low | 🟢 Low | 🟢 Low |
| **Maintainability** | 🔴 Hard | 🟢 Easy | 🟢 Easy | 🟢 Easy |

## My Recommendation

### If you want Workflow's runtime (VM, durability):

**Use Workflow natively.** Write workflows with `'use workflow'` directive, not Mastra syntax.

### If you want Mastra's orchestration (closures, all patterns):

**Use Step-Mode Adapter (already built).** Write steps with `'use step'`, orchestrate with Mastra.

### If you MUST have both (Mastra syntax + Workflow runtime):

**Build WorkflowExecutionEngine with clear limitations:**
- Document that it only supports sequential, parallel, foreach, static sleep
- Throw clear errors for unsupported patterns
- Keep implementation simple (no AST parsing)
- Mark as "experimental" or "limited"

## Implementation Status

✅ **Analysis Complete**: See `/workspace/workflows/WORKFLOW_CODE_GENERATION_PROPOSAL.md`
✅ **POC Code**: See `/workspace/workflows/workflow-engine/poc.ts`
✅ **Code Generator**: Basic implementation for supported patterns
❌ **Runtime Integration**: Needs Workflow runtime connection
❌ **Tests**: Not yet written
❌ **Documentation**: Needs user guide with limitations

## Next Steps

**Tell me which direction to pursue:**

1. **Build limited WorkflowExecutionEngine** (sequential/parallel only)
2. **Enhance step-mode adapter** (already works, just improve DX)
3. **Document native Workflow approach** (best of Workflow features)
4. **Something else** (your idea?)

I can implement whatever you choose!
