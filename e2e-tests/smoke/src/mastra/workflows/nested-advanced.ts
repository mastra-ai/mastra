import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// --- deep-nested-workflow ---
// Tests 2 levels of nesting: outer → middle → inner

const innerMost = createStep({
  id: 'inner-most',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  execute: async ({ inputData }) => {
    return { text: inputData.text.toUpperCase() };
  },
});

export const deepInnerWorkflow = createWorkflow({
  id: 'deep-inner-workflow',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
})
  .then(innerMost)
  .commit();

const middleStep = createStep({
  id: 'middle-step',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  execute: async ({ inputData }) => {
    return { text: `[${inputData.text}]` };
  },
});

export const deepMiddleWorkflow = createWorkflow({
  id: 'deep-middle-workflow',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
})
  .then(deepInnerWorkflow)
  .then(middleStep)
  .commit();

const outerStep = createStep({
  id: 'deep-outer-step',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ final: z.string() }),
  execute: async ({ inputData }) => {
    return { final: `result:${inputData.text}` };
  },
});

export const deepNestedWorkflow = createWorkflow({
  id: 'deep-nested-workflow',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ final: z.string() }),
})
  .then(deepMiddleWorkflow)
  .then(outerStep)
  .commit();

// --- nested-suspend-workflow ---
// Tests suspend/resume inside a nested workflow

const suspendableStep = createStep({
  id: 'nested-suspendable',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ value: z.string(), extra: z.string() }),
  suspendSchema: z.object({ waitingFor: z.string() }),
  resumeSchema: z.object({ extra: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({ waitingFor: inputData.value });
    }
    return { value: inputData.value, extra: resumeData?.extra ?? 'none' };
  },
});

export const nestedSuspendInner = createWorkflow({
  id: 'nested-suspend-inner',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ value: z.string(), extra: z.string() }),
})
  .then(suspendableStep)
  .commit();

const beforeNested = createStep({
  id: 'before-nested-suspend',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ value: z.string() }),
  execute: async ({ inputData }) => {
    return { value: `prepared:${inputData.input}` };
  },
});

const afterNested = createStep({
  id: 'after-nested-suspend',
  inputSchema: z.object({ value: z.string(), extra: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: `${inputData.value}+${inputData.extra}` };
  },
});

export const nestedSuspendWorkflow = createWorkflow({
  id: 'nested-suspend-workflow',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(beforeNested)
  .then(nestedSuspendInner)
  .then(afterNested)
  .commit();
