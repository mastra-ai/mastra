import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// --- sequential-steps ---
// 3 chained steps. Each step receives the previous step's output.

const addGreeting = createStep({
  id: 'add-greeting',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ name: z.string(), greeting: z.string() }),
  execute: async ({ inputData }) => {
    return { name: inputData.name, greeting: `Hello, ${inputData.name}!` };
  },
});

const addFarewell = createStep({
  id: 'add-farewell',
  inputSchema: z.object({ name: z.string(), greeting: z.string() }),
  outputSchema: z.object({ name: z.string(), greeting: z.string(), farewell: z.string() }),
  execute: async ({ inputData }) => {
    return { ...inputData, farewell: `Goodbye, ${inputData.name}!` };
  },
});

const combineMessages = createStep({
  id: 'combine-messages',
  inputSchema: z.object({ name: z.string(), greeting: z.string(), farewell: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => {
    return { message: `${inputData.greeting} ${inputData.farewell}` };
  },
});

export const sequentialSteps = createWorkflow({
  id: 'sequential-steps',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
})
  .then(addGreeting)
  .then(addFarewell)
  .then(combineMessages)
  .commit();

// --- schema-validation ---
// Workflow with strict input/output schemas.

const doubleNumber = createStep({
  id: 'double-number',
  inputSchema: z.object({ value: z.number().min(0).max(100) }),
  outputSchema: z.object({ result: z.number() }),
  execute: async ({ inputData }) => {
    return { result: inputData.value * 2 };
  },
});

export const schemaValidation = createWorkflow({
  id: 'schema-validation',
  inputSchema: z.object({ value: z.number().min(0).max(100) }),
  outputSchema: z.object({ result: z.number() }),
})
  .then(doubleNumber)
  .commit();

// --- map-between-steps ---
// Uses .map() to transform data between steps.

const produceData = createStep({
  id: 'produce-data',
  inputSchema: z.object({ firstName: z.string(), lastName: z.string() }),
  outputSchema: z.object({ firstName: z.string(), lastName: z.string(), fullName: z.string() }),
  execute: async ({ inputData }) => {
    return {
      firstName: inputData.firstName,
      lastName: inputData.lastName,
      fullName: `${inputData.firstName} ${inputData.lastName}`,
    };
  },
});

const consumeMapped = createStep({
  id: 'consume-mapped',
  inputSchema: z.object({ displayName: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
  execute: async ({ inputData }) => {
    return { formatted: `User: ${inputData.displayName}` };
  },
});

export const mapBetweenSteps = createWorkflow({
  id: 'map-between-steps',
  inputSchema: z.object({ firstName: z.string(), lastName: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
})
  .then(produceData)
  .map({
    displayName: {
      step: produceData,
      path: 'fullName',
    },
  })
  .then(consumeMapped)
  .commit();
