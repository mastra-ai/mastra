# @mastra/workflow-adapter

Adapter to use Workflow step-mode compiled functions in Mastra workflows.

## Overview

This package enables you to:

1. Write step logic using Workflow's clean `"use step"` directive
2. Compile with SWC in step mode to get plain async functions
3. Wrap as Mastra steps for powerful orchestration

This gives you the best of both worlds:
- **Workflow**: Clean, concise step definitions
- **Mastra**: Rich orchestration (parallel, conditional, loops, etc.) and multiple execution engines

## Installation

```bash
pnpm add @mastra/workflow-adapter
pnpm add -D @swc/core @workflow/swc-plugin-workflow
```

## Usage

### Step 1: Write Workflow Steps

```typescript
// workflows/math-operations.ts
export async function add(a: number, b: number) {
  'use step';
  return a + b;
}

export async function multiply(a: number, b: number) {
  'use step';
  return a * b;
}

export async function fetchUser(userId: string) {
  'use step';
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}
```

### Step 2: Compile in Step Mode

Add to your `package.json`:

```json
{
  "scripts": {
    "compile:workflow-steps": "swc workflows --plugin @workflow/swc-plugin-workflow={\"mode\":\"step\"} --out-dir .compiled"
  }
}
```

Run compilation:

```bash
pnpm compile:workflow-steps
```

This produces plain async functions in `.compiled/`:

```typescript
// .compiled/math-operations.ts
export async function add(a: number, b: number) {
  return a + b;  // Original logic preserved
}

export async function multiply(a: number, b: number) {
  return a * b;
}

export async function fetchUser(userId: string) {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

// Registration code (ignored by Mastra)
registerStepFunction("step//math-operations.ts//add", add);
// ...
```

### Step 3: Wrap as Mastra Steps

```typescript
// mastra/workflows/calculation-workflow.ts
import { createWorkflow } from '@mastra/core/workflows';
import { wrapWorkflowStep } from '@mastra/workflow-adapter';
import { z } from 'zod';

// Import compiled Workflow steps
import { add, multiply } from '../../.compiled/math-operations';

// Wrap as Mastra steps with schemas
const addStep = wrapWorkflowStep({
  id: 'add',
  workflowStepFn: add,
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.number(),
  argsMapper: (input) => [input.a, input.b],
  description: 'Add two numbers',
});

const multiplyStep = wrapWorkflowStep({
  id: 'multiply',
  workflowStepFn: multiply,
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.number(),
  argsMapper: (input) => [input.a, input.b],
  description: 'Multiply two numbers',
});

// Build Mastra workflow with orchestration
export const calculationWorkflow = createWorkflow({
  id: 'calculation',
  inputSchema: z.object({ x: z.number(), y: z.number() }),
  outputSchema: z.object({ sum: z.number(), product: z.number() }),
})
  .parallel([addStep, multiplyStep])
  .commit();
```

### Step 4: Execute with Mastra

```typescript
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  workflows: {
    calculationWorkflow,
  },
});

// Use with any Mastra execution engine
const run = await calculationWorkflow.createRunAsync();
const result = await run.start({
  inputData: { x: 5, y: 3 },
});

console.log(result);
// { sum: 8, product: 15 }
```

## Advanced Usage

### Batch Wrapping

```typescript
import { wrapWorkflowSteps } from '@mastra/workflow-adapter';
import * as mathSteps from '../.compiled/math-operations';

const { add, multiply, divide } = wrapWorkflowSteps({
  add: {
    workflowStepFn: mathSteps.add,
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    outputSchema: z.number(),
    argsMapper: (input) => [input.a, input.b],
  },
  multiply: {
    workflowStepFn: mathSteps.multiply,
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    outputSchema: z.number(),
    argsMapper: (input) => [input.a, input.b],
  },
});
```

### Complex Example with API Calls

```typescript
// workflows/user-onboarding.ts (Workflow source)
export async function createUser(email: string, name: string) {
  'use step';
  const response = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email, name }),
  });
  return response.json();
}

export async function sendWelcomeEmail(email: string, name: string) {
  'use step';
  await emailService.send({
    to: email,
    subject: 'Welcome!',
    body: `Hi ${name}, welcome to our platform!`,
  });
  return { sent: true };
}

export async function setupUserProfile(userId: string) {
  'use step';
  await database.profiles.create({
    userId,
    preferences: { theme: 'light', notifications: true },
  });
  return { created: true };
}
```

```typescript
// mastra/workflows/onboarding.ts (Mastra workflow)
import { createWorkflow } from '@mastra/core/workflows';
import { wrapWorkflowStep } from '@mastra/workflow-adapter';
import {
  createUser,
  sendWelcomeEmail,
  setupUserProfile,
} from '../../.compiled/user-onboarding';

const createUserStep = wrapWorkflowStep({
  id: 'create-user',
  workflowStepFn: createUser,
  inputSchema: z.object({ email: z.string(), name: z.string() }),
  outputSchema: z.object({ id: z.string(), email: z.string() }),
  argsMapper: (input) => [input.email, input.name],
});

const welcomeEmailStep = wrapWorkflowStep({
  id: 'welcome-email',
  workflowStepFn: sendWelcomeEmail,
  inputSchema: z.object({ email: z.string(), name: z.string() }),
  outputSchema: z.object({ sent: z.boolean() }),
  argsMapper: (input) => [input.email, input.name],
});

const profileStep = wrapWorkflowStep({
  id: 'setup-profile',
  workflowStepFn: setupUserProfile,
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ created: z.boolean() }),
  argsMapper: (input) => [input.userId],
});

export const onboardingWorkflow = createWorkflow({
  id: 'user-onboarding',
  inputSchema: z.object({ email: z.string(), name: z.string() }),
  outputSchema: z.object({ userId: z.string(), profileCreated: z.boolean() }),
})
  .then(createUserStep)
  .parallel([
    welcomeEmailStep,
    profileStep,
  ])
  .commit();
```

## Benefits

✅ **Write steps once**: Use Workflow's clean syntax
✅ **Powerful orchestration**: Leverage Mastra's parallel, conditional, loops
✅ **Multiple engines**: Run with DefaultEngine, Inngest, etc.
✅ **Type safety**: Zod schemas + TypeScript
✅ **Incremental adoption**: Mix Workflow steps with native Mastra steps

## Trade-offs

⚠️ **No VM sandboxing**: Loses Workflow's isolated execution context
⚠️ **No deterministic replay**: Loses Workflow's event log replay
⚠️ **Build step**: Requires compilation before use
⚠️ **Schema duplication**: Need to define Zod schemas separately

## When to Use

Use this adapter when you want to:
- Write clean step definitions with Workflow syntax
- Orchestrate with Mastra's powerful workflow features
- Use multiple execution engines (Inngest, etc.)
- Leverage Mastra's integrations and tools

Consider using Workflow natively when you need:
- VM sandboxing and isolation
- Deterministic replay from event logs
- Workflow's built-in durability model

## Example Project Structure

```
my-app/
├── workflows/                    # Workflow source files
│   ├── math-operations.ts
│   ├── user-management.ts
│   └── notifications.ts
├── .compiled/                    # Compiled step-mode output
│   ├── math-operations.ts        # (gitignored)
│   ├── user-management.ts
│   └── notifications.ts
├── mastra/
│   └── workflows/                # Mastra workflow definitions
│       ├── calculation.ts
│       ├── onboarding.ts
│       └── daily-digest.ts
└── package.json
```

## License

MIT
