/**
 * Example showing how to use Workflow steps in Mastra workflows
 */

import { Mastra } from '@mastra/core';
import { createWorkflow } from '@mastra/core/workflows';
import { wrapWorkflowStep } from '../src/index';
import { z } from 'zod';

// ============================================================================
// STEP 1: These would be your original Workflow step definitions
// File: workflows/math-steps.ts
// ============================================================================

/*
export async function add(a: number, b: number) {
  'use step';
  return a + b;
}

export async function multiply(a: number, b: number) {
  'use step';
  return a * b;
}

export async function square(x: number) {
  'use step';
  return x * x;
}
*/

// ============================================================================
// STEP 2: After running: pnpm compile:workflow-steps
// The compiled output would look like this (plain functions)
// File: .compiled/math-steps.ts
// ============================================================================

// Simulating the compiled output (without the registerStepFunction calls)
async function add(a: number, b: number) {
  return a + b;
}

async function multiply(a: number, b: number) {
  return a * b;
}

async function square(x: number) {
  return x * x;
}

// ============================================================================
// STEP 3: Wrap the compiled steps as Mastra steps
// ============================================================================

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

const squareStep = wrapWorkflowStep({
  id: 'square',
  workflowStepFn: square,
  inputSchema: z.object({ x: z.number() }),
  outputSchema: z.number(),
  argsMapper: (input) => [input.x],
  description: 'Square a number',
});

// ============================================================================
// STEP 4: Build Mastra workflows using the wrapped steps
// ============================================================================

// Example 1: Simple sequential workflow
const simpleWorkflow = createWorkflow({
  id: 'simple-calculation',
  inputSchema: z.object({ x: z.number(), y: z.number() }),
  outputSchema: z.number(),
})
  .then(addStep)      // x + y
  .then(squareStep)   // (x + y)²
  .commit();

// Example 2: Parallel execution
const parallelWorkflow = createWorkflow({
  id: 'parallel-calculation',
  inputSchema: z.object({ x: z.number(), y: z.number() }),
  outputSchema: z.object({
    sum: z.number(),
    product: z.number(),
    squareX: z.number(),
    squareY: z.number(),
  }),
})
  .parallel([
    addStep,      // Calculate sum in parallel
    multiplyStep, // Calculate product in parallel
  ])
  .commit();

// Example 3: Complex workflow with mapping
const complexWorkflow = createWorkflow({
  id: 'complex-calculation',
  inputSchema: z.object({ a: z.number(), b: z.number(), c: z.number() }),
  outputSchema: z.number(),
})
  // First add a + b
  .then(addStep)
  // Then multiply result by c
  .map((ctx) => ({
    a: ctx.getStepResult(addStep),
    b: z.literal(5).parse(5), // Example of adding a constant
  }))
  .then(multiplyStep)
  .commit();

// ============================================================================
// STEP 5: Execute the workflows
// ============================================================================

async function main() {
  const mastra = new Mastra({
    workflows: {
      simpleWorkflow,
      parallelWorkflow,
      complexWorkflow,
    },
  });

  console.log('=== Simple Workflow ===');
  const simpleRun = await simpleWorkflow.createRunAsync();
  const simpleResult = await simpleRun.start({
    inputData: { x: 3, y: 4 },
  });
  console.log('Result:', simpleResult);
  // Expected: (3 + 4)² = 49

  console.log('\n=== Parallel Workflow ===');
  const parallelRun = await parallelWorkflow.createRunAsync();
  const parallelResult = await parallelRun.start({
    inputData: { x: 5, y: 3 },
  });
  console.log('Result:', parallelResult);
  // Expected: { sum: 8, product: 15, squareX: 25, squareY: 9 }

  console.log('\n=== Complex Workflow ===');
  const complexRun = await complexWorkflow.createRunAsync();
  const complexResult = await complexRun.start({
    inputData: { a: 2, b: 3, c: 4 },
  });
  console.log('Result:', complexResult);
  // Expected: (2 + 3) * 5 = 25
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
