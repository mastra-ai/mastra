import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const stateSchema = z.object({
  count: z.number(),
  log: z.array(z.string()),
});

// --- stateful-workflow ---
const stepOne = createStep({
  id: 'state-step-one',
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ action: z.string() }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    await setState({
      count: (state?.count ?? 0) + 1,
      log: [...(state?.log ?? []), `step-one:${inputData.action}`],
    });
    return { action: inputData.action };
  },
});

const stepTwo = createStep({
  id: 'state-step-two',
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ finalCount: z.number(), finalLog: z.array(z.string()) }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    const newCount = (state?.count ?? 0) + 1;
    const newLog = [...(state?.log ?? []), `step-two:${inputData.action}`];
    await setState({ count: newCount, log: newLog });
    return { finalCount: newCount, finalLog: newLog };
  },
});

export const statefulWorkflow = createWorkflow({
  id: 'stateful-workflow',
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ finalCount: z.number(), finalLog: z.array(z.string()) }),
  stateSchema,
})
  .then(stepOne)
  .then(stepTwo)
  .commit();

// --- initial-state ---
const readAndModify = createStep({
  id: 'read-and-modify',
  inputSchema: z.object({ addValue: z.string() }),
  outputSchema: z.object({
    originalCount: z.number(),
    newCount: z.number(),
    log: z.array(z.string()),
  }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    const originalCount = state?.count ?? 0;
    const newLog = [...(state?.log ?? []), inputData.addValue];
    await setState({ count: originalCount + 10, log: newLog });
    return { originalCount, newCount: originalCount + 10, log: newLog };
  },
});

export const initialStateWorkflow = createWorkflow({
  id: 'initial-state',
  inputSchema: z.object({ addValue: z.string() }),
  outputSchema: z.object({
    originalCount: z.number(),
    newCount: z.number(),
    log: z.array(z.string()),
  }),
  stateSchema,
})
  .then(readAndModify)
  .commit();
