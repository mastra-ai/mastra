import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// --- branch-workflow ---
const classifyInput = createStep({
  id: 'classify-input',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number(), category: z.string() }),
  execute: async ({ inputData }) => {
    const category = inputData.value >= 0 ? 'positive' : 'negative';
    return { value: inputData.value, category };
  },
});

const handlePositive = createStep({
  id: 'handle-positive',
  inputSchema: z.object({ value: z.number(), category: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: `Positive: ${inputData.value}` };
  },
});

const handleNegative = createStep({
  id: 'handle-negative',
  inputSchema: z.object({ value: z.number(), category: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: `Negative: ${inputData.value}` };
  },
});

export const branchWorkflow = createWorkflow({
  id: 'branch-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(classifyInput)
  .branch([
    [async ({ inputData }) => inputData.category === 'positive', handlePositive],
    [async ({ inputData }) => inputData.category === 'negative', handleNegative],
  ])
  .commit();

// --- parallel-workflow ---
const computeSquare = createStep({
  id: 'compute-square',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ square: z.number() }),
  execute: async ({ inputData }) => {
    return { square: inputData.value * inputData.value };
  },
});

const computeDouble = createStep({
  id: 'compute-double',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ double: z.number() }),
  execute: async ({ inputData }) => {
    return { double: inputData.value * 2 };
  },
});

const computeNegate = createStep({
  id: 'compute-negate',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ negated: z.number() }),
  execute: async ({ inputData }) => {
    return { negated: -inputData.value };
  },
});

export const parallelWorkflow = createWorkflow({
  id: 'parallel-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ square: z.number(), double: z.number(), negated: z.number() }),
})
  .parallel([computeSquare, computeDouble, computeNegate])
  .commit();

// --- dowhile-workflow ---
const incrementCounter = createStep({
  id: 'increment-counter',
  inputSchema: z.object({ count: z.number() }),
  outputSchema: z.object({ count: z.number() }),
  execute: async ({ inputData }) => {
    return { count: inputData.count + 1 };
  },
});

export const dowhileWorkflow = createWorkflow({
  id: 'dowhile-workflow',
  inputSchema: z.object({ count: z.number() }),
  outputSchema: z.object({ count: z.number() }),
})
  .dowhile(incrementCounter, async ({ inputData }) => inputData.count < 5)
  .commit();

// --- dountil-workflow ---
const accumulateValue = createStep({
  id: 'accumulate-value',
  inputSchema: z.object({ total: z.number() }),
  outputSchema: z.object({ total: z.number() }),
  execute: async ({ inputData }) => {
    return { total: inputData.total + 10 };
  },
});

export const dountilWorkflow = createWorkflow({
  id: 'dountil-workflow',
  inputSchema: z.object({ total: z.number() }),
  outputSchema: z.object({ total: z.number() }),
})
  .dountil(accumulateValue, async ({ inputData }) => inputData.total >= 50)
  .commit();

// --- foreach-workflow ---
const processItem = createStep({
  id: 'process-item',
  inputSchema: z.object({ item: z.string() }),
  outputSchema: z.object({ processed: z.string() }),
  execute: async ({ inputData }) => {
    return { processed: inputData.item.toUpperCase() };
  },
});

const produceItems = createStep({
  id: 'produce-items',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.array(z.object({ item: z.string() })),
  execute: async ({ inputData }) => {
    return inputData.items.map(item => ({ item }));
  },
});

export const foreachWorkflow = createWorkflow({
  id: 'foreach-workflow',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.array(z.object({ processed: z.string() })),
})
  .then(produceItems)
  .foreach(processItem, { concurrency: 2 })
  .commit();
