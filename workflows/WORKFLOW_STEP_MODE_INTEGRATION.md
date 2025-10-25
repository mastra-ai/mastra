# Workflow Step-Mode Integration Strategy

## Key Discovery

After examining the Workflow compiler transformations, **integration IS feasible** by using the transformed step functions from Workflow's "step mode" compilation. The user's insight is correct: we don't need to integrate with Workflow's runtime - we can use the transformed function outputs directly.

## How Workflow Compilation Works

The SWC plugin has three modes, but **step mode** is the key:

### Step Mode Transformation

**Input (Workflow code):**
```typescript
export async function add(a, b) {
  'use step';
  return a + b;
}
```

**Output (Transformed code):**
```typescript
import { registerStepFunction } from "workflow/internal/private";

export async function add(a, b) {
  return a + b;  // ← Original logic preserved!
}

registerStepFunction("step//input.js//add", add);
```

**Key Points:**
- ✅ The function body is **preserved exactly as-is**
- ✅ No runtime dependencies for execution (only for registration)
- ✅ It's just a normal async function
- ✅ Can be imported and used anywhere

### Workflow Mode (for contrast)

**Output (Transformed code):**
```typescript
export async function add(a, b) {
  return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step//input.js//add")(a, b);
}
```

- ❌ Function body replaced with runtime call
- ❌ Requires Workflow's execution context
- ❌ Not usable outside Workflow runtime

## Proposed Integration Architecture

### Step 1: Compile Workflow Files in Step Mode

Use Workflow's SWC plugin to transform your workflow definitions:

```bash
# Add to build process
npx swc workflows/my-steps.ts \
  --plugin @workflow/swc-plugin-workflow={"mode":"step"} \
  --out-dir .mastra/workflow-steps
```

This produces clean async functions that can be imported.

### Step 2: Create Mastra Step Wrappers

Build a helper to automatically wrap transformed Workflow steps:

```typescript
// workflows/mastra-adapter.ts
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

/**
 * Wraps a Workflow step function as a Mastra step
 */
export function wrapWorkflowStep<
  TInput extends z.ZodType<any>,
  TOutput extends z.ZodType<any>
>(options: {
  id: string;
  workflowStepFn: (...args: any[]) => Promise<any>;
  inputSchema: TInput;
  outputSchema: TOutput;
  description?: string;
}) {
  return createStep({
    id: options.id,
    description: options.description,
    inputSchema: options.inputSchema,
    outputSchema: options.outputSchema,
    execute: async ({ inputData }) => {
      // Call the compiled Workflow step function
      // The function is just a normal async function at this point
      const result = await options.workflowStepFn(inputData);
      return result;
    },
  });
}
```

### Step 3: Use in Mastra Workflows

```typescript
// workflows/my-workflow.ts
import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { wrapWorkflowStep } from './mastra-adapter';

// Import the compiled Workflow step (from step-mode output)
import { add, multiply, sendEmail } from './.mastra/workflow-steps/my-steps';

// Wrap each Workflow step as a Mastra step
const addStep = wrapWorkflowStep({
  id: 'add',
  workflowStepFn: add,
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.number(),
  description: 'Add two numbers',
});

const multiplyStep = wrapWorkflowStep({
  id: 'multiply',
  workflowStepFn: multiply,
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.number(),
  description: 'Multiply two numbers',
});

const emailStep = wrapWorkflowStep({
  id: 'sendEmail',
  workflowStepFn: sendEmail,
  inputSchema: z.object({ 
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  outputSchema: z.object({ status: z.string() }),
  description: 'Send email notification',
});

// Build a Mastra workflow using the wrapped steps
export const calculationWorkflow = createWorkflow({
  id: 'calculation-workflow',
  inputSchema: z.object({ x: z.number(), y: z.number() }),
  outputSchema: z.object({ 
    result: z.number(),
    emailStatus: z.string(),
  }),
})
  .then(addStep)
  .then(multiplyStep)
  .parallel([emailStep, /* other notifications */])
  .commit();
```

## Complete Example

### Original Workflow Code

```typescript
// workflows/math-operations.ts (Source file)

export async function fetchUserPreferences(userId: string) {
  'use step';
  const response = await fetch(`/api/users/${userId}/preferences`);
  return response.json();
}

export async function calculateDiscount(amount: number, tier: string) {
  'use step';
  const discounts = { bronze: 0.05, silver: 0.1, gold: 0.2 };
  return amount * (1 - discounts[tier]);
}

export async function processPayment(amount: number, method: string) {
  'use step';
  // Complex payment processing logic
  const result = await paymentGateway.charge({ amount, method });
  return result;
}

export async function sendReceipt(email: string, amount: number) {
  'use step';
  await emailService.send({
    to: email,
    subject: 'Payment Receipt',
    body: `Thank you! Amount: $${amount}`,
  });
  return { sent: true };
}
```

### After Step-Mode Compilation

```typescript
// .mastra/workflow-steps/math-operations.ts (Compiled output)
import { registerStepFunction } from "workflow/internal/private";

export async function fetchUserPreferences(userId: string) {
  const response = await fetch(`/api/users/${userId}/preferences`);
  return response.json();
}

export async function calculateDiscount(amount: number, tier: string) {
  const discounts = { bronze: 0.05, silver: 0.1, gold: 0.2 };
  return amount * (1 - discounts[tier]);
}

export async function processPayment(amount: number, method: string) {
  const result = await paymentGateway.charge({ amount, method });
  return result;
}

export async function sendReceipt(email: string, amount: number) {
  await emailService.send({
    to: email,
    subject: 'Payment Receipt',
    body: `Thank you! Amount: $${amount}`,
  });
  return { sent: true };
}

registerStepFunction("step//math-operations.ts//fetchUserPreferences", fetchUserPreferences);
registerStepFunction("step//math-operations.ts//calculateDiscount", calculateDiscount);
registerStepFunction("step//math-operations.ts//processPayment", processPayment);
registerStepFunction("step//math-operations.ts//sendReceipt", sendReceipt);
```

### Mastra Workflow Using Compiled Steps

```typescript
// mastra/workflows/payment-workflow.ts
import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { wrapWorkflowStep } from './mastra-adapter';

// Import compiled Workflow steps
import {
  fetchUserPreferences,
  calculateDiscount,
  processPayment,
  sendReceipt,
} from '../.mastra/workflow-steps/math-operations';

// Wrap as Mastra steps
const getUserStep = wrapWorkflowStep({
  id: 'fetch-user-preferences',
  workflowStepFn: fetchUserPreferences,
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ tier: z.string(), email: z.string() }),
});

const discountStep = wrapWorkflowStep({
  id: 'calculate-discount',
  workflowStepFn: calculateDiscount,
  inputSchema: z.object({ amount: z.number(), tier: z.string() }),
  outputSchema: z.number(),
});

const paymentStep = wrapWorkflowStep({
  id: 'process-payment',
  workflowStepFn: processPayment,
  inputSchema: z.object({ amount: z.number(), method: z.string() }),
  outputSchema: z.object({ success: z.boolean(), transactionId: z.string() }),
});

const receiptStep = wrapWorkflowStep({
  id: 'send-receipt',
  workflowStepFn: sendReceipt,
  inputSchema: z.object({ email: z.string(), amount: z.number() }),
  outputSchema: z.object({ sent: z.boolean() }),
});

// Build Mastra workflow with orchestration features
export const paymentWorkflow = createWorkflow({
  id: 'payment-workflow',
  inputSchema: z.object({ 
    userId: z.string(), 
    amount: z.number(),
    method: z.string(),
  }),
  outputSchema: z.object({ 
    transactionId: z.string(),
    finalAmount: z.number(),
  }),
})
  .then(getUserStep) // Fetch user preferences
  .map(({ step, path }) => ({
    // Map to discount calculation
    amount: mapVariable({ initData: paymentWorkflow, path: 'amount' }),
    tier: mapVariable({ step: getUserStep, path: 'tier' }),
  }))
  .then(discountStep) // Calculate discounted amount
  .map(({ step }) => ({
    // Map to payment processing
    amount: mapVariable({ step: discountStep, path: '.' }),
    method: mapVariable({ initData: paymentWorkflow, path: 'method' }),
  }))
  .then(paymentStep) // Process payment
  .parallel([
    // Send notifications in parallel
    receiptStep,
    // Could add more notification steps
  ])
  .commit();
```

## Benefits of This Approach

### ✅ Advantages

1. **Reuse Workflow Step Logic**
   - Write steps once with `"use step"` directive
   - Use in both Workflow runtime AND Mastra workflows
   - Same business logic, different orchestration

2. **Best of Both Worlds**
   - Workflow: Clean, concise step definitions
   - Mastra: Powerful orchestration (parallel, conditional, loops, etc.)
   - Mastra: Multiple execution engines (local, Inngest, etc.)

3. **Incremental Adoption**
   - Start with Workflow steps
   - Gradually add Mastra orchestration
   - Mix and match as needed

4. **Type Safety**
   - Original Workflow steps maintain types
   - Mastra schemas provide additional validation
   - End-to-end type checking

5. **No Runtime Dependency**
   - Compiled steps don't need Workflow runtime
   - Just plain async functions
   - Minimal overhead

### ⚠️ Trade-offs

1. **Loses Workflow Runtime Features**
   - No VM sandboxing
   - No deterministic replay
   - No automatic event logging
   - These are Workflow runtime features, not in the step functions themselves

2. **Build Step Required**
   - Need to compile Workflow files in step mode
   - Additional build complexity
   - Need to track compiled output

3. **Schema Duplication**
   - Workflow steps use TypeScript types
   - Mastra needs Zod schemas
   - Manual mapping required (could be automated with codegen)

4. **Different Error Handling**
   - Workflow's `FatalError`/`RetryableError` semantics
   - Mastra's retry configuration
   - Need to align approaches

## Implementation Plan

### Phase 1: Proof of Concept

1. Set up SWC plugin with step mode compilation
2. Create basic wrapper helper
3. Test with simple Workflow steps
4. Validate in Mastra workflow

### Phase 2: Developer Experience

1. Automated compilation in build pipeline
2. Type generation from Workflow steps to Zod schemas
3. CLI helper: `mastra workflow wrap <file>`
4. Documentation and examples

### Phase 3: Advanced Features

1. Automatic retry mapping
2. Error translation
3. Telemetry integration
4. Schema inference

## Example Build Setup

```json
// package.json
{
  "scripts": {
    "build:workflow-steps": "swc workflows/**/*.ts --plugin @workflow/swc-plugin-workflow={\"mode\":\"step\"} --out-dir .mastra/workflow-steps",
    "build:mastra": "mastra build",
    "build": "npm run build:workflow-steps && npm run build:mastra"
  }
}
```

## Comparison: Before vs After

### Before (Pure Workflow)

```typescript
// workflows/example.ts
export async function step1(x: number) {
  'use step';
  return x * 2;
}

export async function myWorkflow(x: number) {
  'use workflow';
  const result1 = await step1(x);
  const result2 = await step1(result1);
  return result2;
}

// Usage
const result = await myWorkflow(5); // Uses Workflow runtime
```

**Pros:**
- Very concise
- Automatic durability
- VM sandboxing

**Cons:**
- Limited orchestration (sequential only in this example)
- Tied to Workflow runtime
- No conditional/parallel/loop patterns (without more code)

### After (Workflow Steps + Mastra Orchestration)

```typescript
// workflows/example.ts (same step definitions)
export async function step1(x: number) {
  'use step';
  return x * 2;
}

// mastra/workflows/example.ts
import { createWorkflow } from '@mastra/core/workflows';
import { wrapWorkflowStep } from './adapter';
import { step1 } from '../.mastra/workflow-steps/example';

const step1Wrapped = wrapWorkflowStep({
  id: 'step1',
  workflowStepFn: step1,
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.number(),
});

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.number(),
})
  .dountil(
    step1Wrapped,
    async ({ inputData }) => inputData >= 20
  )
  .commit();

// Usage
const run = await myWorkflow.createRunAsync();
const result = await run.start({ inputData: { x: 5 } });
```

**Pros:**
- Rich orchestration (loops, conditions, parallel)
- Multiple execution engines (local, Inngest)
- Workflow resumability
- Storage persistence
- Observable execution

**Cons:**
- More verbose
- Build step required
- No VM sandboxing
- Manual schema definition

## Conclusion

**YES, integration is feasible!** By using Workflow's step-mode compilation, we can:

1. Write step logic using Workflow's clean `"use step"` syntax
2. Compile to plain async functions
3. Wrap as Mastra steps
4. Orchestrate with Mastra's powerful workflow features

This gives developers:
- **Workflow**: Clean step definitions with TypeScript
- **Mastra**: Rich orchestration, multiple engines, powerful patterns

The key insight is that we don't need to integrate with Workflow's *runtime* - we just need to consume the *compiled output* from step mode, which is just regular JavaScript functions.
