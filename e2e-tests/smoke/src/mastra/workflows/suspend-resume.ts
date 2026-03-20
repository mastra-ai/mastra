import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// --- basic-suspend ---
const prepareRequest = createStep({
  id: 'prepare-request',
  inputSchema: z.object({ item: z.string() }),
  outputSchema: z.object({ item: z.string(), requestId: z.string() }),
  execute: async ({ inputData }) => {
    return { item: inputData.item, requestId: `req-${Date.now()}` };
  },
});

const awaitApproval = createStep({
  id: 'await-approval',
  inputSchema: z.object({ item: z.string(), requestId: z.string() }),
  outputSchema: z.object({ item: z.string(), approved: z.boolean() }),
  suspendSchema: z.object({ message: z.string(), requestId: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({
        message: `Please approve: ${inputData.item}`,
        requestId: inputData.requestId,
      });
    }
    return { item: inputData.item, approved: resumeData?.approved ?? false };
  },
});

const finalize = createStep({
  id: 'finalize',
  inputSchema: z.object({ item: z.string(), approved: z.boolean() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return {
      result: inputData.approved ? `${inputData.item} approved` : `${inputData.item} rejected`,
    };
  },
});

export const basicSuspend = createWorkflow({
  id: 'basic-suspend',
  inputSchema: z.object({ item: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(prepareRequest)
  .then(awaitApproval)
  .then(finalize)
  .commit();

// --- parallel-suspend ---
const suspendBranchA = createStep({
  id: 'suspend-branch-a',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ branchA: z.string() }),
  suspendSchema: z.object({ branch: z.literal('A') }),
  resumeSchema: z.object({ dataA: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({ branch: 'A' }, { resumeLabel: 'branch-a' });
    }
    return { branchA: resumeData?.dataA ?? 'default' };
  },
});

const suspendBranchB = createStep({
  id: 'suspend-branch-b',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ branchB: z.string() }),
  suspendSchema: z.object({ branch: z.literal('B') }),
  resumeSchema: z.object({ dataB: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({ branch: 'B' }, { resumeLabel: 'branch-b' });
    }
    return { branchB: resumeData?.dataB ?? 'default' };
  },
});

export const parallelSuspend = createWorkflow({
  id: 'parallel-suspend',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ branchA: z.string(), branchB: z.string() }),
})
  .parallel([suspendBranchA, suspendBranchB])
  .commit();

// --- loop-suspend ---
const loopWithSuspend = createStep({
  id: 'loop-with-suspend',
  inputSchema: z.object({ iteration: z.number(), items: z.array(z.string()) }),
  outputSchema: z.object({ iteration: z.number(), items: z.array(z.string()) }),
  suspendSchema: z.object({ currentIteration: z.number() }),
  resumeSchema: z.object({ value: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({ currentIteration: inputData.iteration });
    }
    return {
      iteration: inputData.iteration + 1,
      items: [...inputData.items, resumeData?.value ?? 'none'],
    };
  },
});

export const loopSuspend = createWorkflow({
  id: 'loop-suspend',
  inputSchema: z.object({ iteration: z.number(), items: z.array(z.string()) }),
  outputSchema: z.object({ iteration: z.number(), items: z.array(z.string()) }),
})
  .dowhile(loopWithSuspend, async ({ inputData }) => inputData.iteration < 3)
  .commit();
