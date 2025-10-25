# How Workflow Handles Conditionals and Loops

## The Answer: Pure JavaScript! 🎉

**In Workflow, you write conditionals and loops using standard JavaScript.**

The `'use workflow'` directive tells the SWC compiler to transform step calls, but **regular JavaScript control flow stays as-is**.

## Examples from Workflow's Test Suite

### Example 1: For Loop + While Loop

From `/tmp/workflow/packages/core/src/workflow.test.ts:610-623`:

```javascript
'use workflow';

async function workflow() {
  const promises = new Map();
  const done = [];
  
  // Regular for loop
  for (let i = 0; i < 5; i++) {
    const dur = 1000 * (10 - i);
    promises.set(i, promiseRaceStressTestDelayStep(dur, i));
  }

  // Regular while loop
  while (promises.size > 0) {
    const res = await Promise.race(promises.values());
    done.push(res);
    promises.delete(res);
  }
  
  return done;
}
```

### Example 2: Try-Catch

From `/tmp/workflow/packages/core/src/workflow.test.ts:67-75`:

```javascript
'use workflow';

function workflow() {
  try {
    throw new TypeError("my workflow error");
  } catch (err) {
    return err;
  }
}
```

### Example 3: Conditionals (Inferred)

While not explicitly in the tests I found, conditionals would work the same way:

```javascript
'use workflow';

async function myWorkflow(input) {
  const result = await checkScore(input);
  
  // Regular if/else
  if (result.score > 80) {
    return await highScoreStep(result);
  } else if (result.score > 50) {
    return await mediumScoreStep(result);
  } else {
    return await lowScoreStep(result);
  }
}
```

### Example 4: For-Await Loop

From `/tmp/workflow/packages/core/src/workflow.test.ts:1253`:

```javascript
'use workflow';

async function workflow() {
  const hook = createHook();
  
  // Regular for-await loop
  for await (const payload of hook) {
    // Process each payload
    await processPayload(payload);
  }
}
```

## What the Compiler Does

### Input (Workflow Code):

```javascript
'use workflow';

export async function myWorkflow(input) {
  const r1 = await step1(input);
  
  if (r1.value > 10) {
    const r2 = await step2(r1);
    return r2;
  } else {
    const r3 = await step3(r1);
    return r3;
  }
}
```

### Output (After SWC Compilation):

```javascript
export async function myWorkflow(input) {
  // Step calls are transformed to use WORKFLOW_USE_STEP
  const r1 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step1")(input);
  
  // Control flow is UNCHANGED!
  if (r1.value > 10) {
    const r2 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step2")(r1);
    return r2;
  } else {
    const r3 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step3")(r1);
    return r3;
  }
}
```

**Key insight**: Only the **step calls** are transformed. The `if/else` structure remains pure JavaScript!

## This Changes Everything for Code Generation! 🚀

### What This Means for WorkflowExecutionEngine

Since Workflow uses **pure JavaScript** for control flow, we CAN generate it!

**Before (I thought it was impossible):**
```typescript
// Mastra branch with closure - how to serialize this?
.branch([
  [async ({ inputData }) => inputData.score > 80, highStep]
])
```

**Now (It's possible!):**
```typescript
// We can generate pure JavaScript if/else!
if (r_checkScore.score > 80) {
  result = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("highStep")(r_checkScore);
}
```

### The NEW Challenge

The problem isn't that we can't generate the code - **we can!**

The problem is: **How do we extract the condition from the closure?**

```typescript
// User writes this in Mastra:
.branch([
  // This is a closure - it's already compiled JavaScript
  [async ({ inputData }) => inputData.score > 80, highStep],
  [async ({ inputData }) => inputData.score > 50, mediumStep],
])

// We need to generate:
if (r_prev.score > 80) {
  result = await step("highStep")(r_prev);
} else if (r_prev.score > 50) {
  result = await step("mediumStep")(r_prev);
}

// But how do we get "r_prev.score > 80" from the closure?
```

## Solutions for Code Generation

### Solution 1: Function Serialization (Hacky but Works)

```typescript
class CodeGenerator {
  generateBranch(entry) {
    const conditions = entry.conditions.map(fn => {
      // Get function source code
      const src = fn.toString();
      // Parse: "async ({ inputData }) => inputData.score > 80"
      // Extract: "inputData.score > 80"
      const match = src.match(/=>\s*(.+)$/);
      const condition = match[1];
      // Replace inputData with current variable name
      return condition.replace(/inputData\./g, 'r_prev.');
    });
    
    let code = '';
    conditions.forEach((cond, i) => {
      if (i === 0) {
        code += `if (${cond}) {\n`;
      } else if (i === conditions.length - 1) {
        code += `} else {\n`;
      } else {
        code += `} else if (${cond}) {\n`;
      }
      code += `  result = await step("${entry.steps[i].step.id}")(r_prev);\n`;
    });
    code += '}';
    
    return code;
  }
}
```

**Pros:**
- ✅ Works for simple expressions
- ✅ No new API needed

**Cons:**
- ❌ Fragile - breaks with complex conditions
- ❌ Can't handle closures with captured variables
- ❌ Minification breaks it

### Solution 2: DSL for Conditions (Clean but New API)

```typescript
// Instead of closures, use expression objects
.branchWhen([
  [{ field: 'score', op: '>', value: 80 }, highStep],
  [{ field: 'score', op: '>', value: 50 }, mediumStep],
  [{ always: true }, lowStep],
])

// Easy to generate:
if (r_prev.score > 80) {
  result = await step("highStep")(r_prev);
} else if (r_prev.score > 50) {
  result = await step("mediumStep")(r_prev);
} else {
  result = await step("lowStep")(r_prev);
}
```

**Pros:**
- ✅ Clean and serializable
- ✅ Easy to generate code
- ✅ Type-safe

**Cons:**
- ❌ New API to learn
- ❌ Less flexible than functions
- ❌ Doesn't feel like Mastra

### Solution 3: Code Strings (Similar to Workflow)

```typescript
// Take code strings directly
.branchCode([
  ['inputData.score > 80', highStep],
  ['inputData.score > 50', mediumStep],
  ['true', lowStep],
])

// Generate:
if (r_prev.score > 80) {
  result = await step("highStep")(r_prev);
}
// ... etc
```

**Pros:**
- ✅ Flexible like Workflow
- ✅ Easy to generate

**Cons:**
- ❌ No type checking
- ❌ Runtime errors if wrong
- ❌ Not typical Mastra style

### Solution 4: Limited Support (Recommended)

**Only support sequential and parallel** - no branching/loops in WorkflowExecutionEngine:

```typescript
// ✅ This works
const workflow = createWorkflow({
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .then(step1)
  .parallel([step2, step3])
  .then(step4)
  .commit();

// ❌ This throws clear error
const workflow = createWorkflow({
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .branch([...])  // Error: Not supported in WorkflowExecutionEngine
  .commit();
```

**Pros:**
- ✅ Simple and maintainable
- ✅ Clear limitations
- ✅ No hacky serialization

**Cons:**
- ❌ Limited functionality
- ❌ Users need to know the limitations

## Comparison: Mastra vs Workflow

| Pattern | Mastra | Workflow | Code Generation |
|---------|--------|----------|-----------------|
| **Sequential** | `.then(step)` | `await step()` | ✅ Easy |
| **Parallel** | `.parallel([...])` | `Promise.all([...])` | ✅ Easy |
| **Conditional** | `.branch([closure, step])` | `if (expr) { await step() }` | ⚠️ Need to extract condition |
| **Loop** | `.dountil(step, closure)` | `while (expr) { await step() }` | ⚠️ Need to extract condition |
| **Foreach** | `.foreach(step, opts)` | `for (let x of arr) { await step() }` | ✅ Easy |

## Key Insight

**Workflow doesn't have this problem** because users write the control flow directly:

```javascript
// User writes this directly in Workflow:
if (score > 80) {
  await highStep();
}

// It compiles to:
if (score > 80) {
  await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("highStep")();
}
```

**Mastra DOES have this problem** because we're generating FROM a graph:

```typescript
// User writes this in Mastra:
.branch([
  [async ({ inputData }) => inputData.score > 80, highStep]
])

// Creates graph:
{
  type: 'conditional',
  conditions: [Function], // ← Can't serialize this!
  steps: [...]
}

// We need to generate:
if (score > 80) { ... }  // ← How?
```

## Recommendation

### For Full Control Flow: Write Native Workflow

```javascript
'use workflow';

export async function myWorkflow(input) {
  const r1 = await step1(input);
  
  if (r1.score > 80) {
    return await highStep(r1);
  } else if (r1.score > 50) {
    return await mediumStep(r1);
  } else {
    return await lowStep(r1);
  }
}
```

### For Mastra Orchestration: Use Step-Mode Adapter

```typescript
// Steps compiled in step mode
const wrappedStep1 = wrapWorkflowStep({ workflowStepFn: step1, ... });

// Orchestrate with Mastra (full features!)
const workflow = createWorkflow({...})
  .then(wrappedStep1)
  .branch([
    [async ({ inputData }) => inputData.score > 80, highStep],  // ✅ Works!
  ])
  .commit();
```

### For Limited Workflow Runtime: WorkflowExecutionEngine

```typescript
// Only sequential and parallel
const workflow = createWorkflow({
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .then(step1)
  .parallel([step2, step3])
  .then(step4)
  .commit();
```

## Next Steps

Now that we know Workflow uses pure JavaScript for control flow, which approach do you want?

1. **Native Workflow** - Write workflows in Workflow syntax with full control flow
2. **Step-Mode Adapter** - Use Mastra orchestration with all features
3. **Limited WorkflowExecutionEngine** - Sequential/parallel only, generate code
4. **Full WorkflowExecutionEngine** - Use Solution 1 or 2 above to handle conditionals

Let me know!
