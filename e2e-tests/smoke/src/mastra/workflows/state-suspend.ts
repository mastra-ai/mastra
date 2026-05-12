import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const stateSchema = z.object({
  count: z.number(),
  log: z.array(z.string()),
});

// --- state-suspend-workflow ---
// Tests that state persists across a suspend/resume cycle.
const incrementAndLog = createStep({
  id: 'increment-and-log',
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ action: z.string() }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    await setState({
      count: (state?.count ?? 0) + 1,
      log: [...(state?.log ?? []), `before-suspend:${inputData.action}`],
    });
    return { action: inputData.action };
  },
});

const suspendForApproval = createStep({
  id: 'suspend-for-approval',
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ action: z.string(), approved: z.boolean() }),
  stateSchema,
  suspendSchema: z.object({ pendingAction: z.string(), currentCount: z.number() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend, state, setState }) => {
    if (!resumeData) {
      await suspend({
        pendingAction: inputData.action,
        currentCount: state?.count ?? 0,
      });
    }
    const approved = resumeData?.approved ?? false;
    await setState({
      count: (state?.count ?? 0) + 1,
      log: [...(state?.log ?? []), `after-resume:${approved}`],
    });
    return { action: inputData.action, approved };
  },
});

const finalizeWithState = createStep({
  id: 'finalize-with-state',
  inputSchema: z.object({ action: z.string(), approved: z.boolean() }),
  outputSchema: z.object({ finalCount: z.number(), finalLog: z.array(z.string()), approved: z.boolean() }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    const finalCount = (state?.count ?? 0) + 1;
    const finalLog = [...(state?.log ?? []), `finalize:${inputData.approved}`];
    await setState({ count: finalCount, log: finalLog });
    return { finalCount, finalLog, approved: inputData.approved };
  },
});

export const stateSuspendWorkflow = createWorkflow({
  id: 'state-suspend-workflow',
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ finalCount: z.number(), finalLog: z.array(z.string()), approved: z.boolean() }),
  stateSchema,
})
  .then(incrementAndLog)
  .then(suspendForApproval)
  .then(finalizeWithState)
  .commit();

// --- state-loop-workflow ---
// Tests state accumulation inside a dowhile loop.
const loopWithState = createStep({
  id: 'loop-with-state',
  inputSchema: z.object({ iteration: z.number() }),
  outputSchema: z.object({ iteration: z.number() }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    const newIteration = inputData.iteration + 1;
    await setState({
      count: (state?.count ?? 0) + 1,
      log: [...(state?.log ?? []), `iteration:${newIteration}`],
    });
    return { iteration: newIteration };
  },
});

const readLoopState = createStep({
  id: 'read-loop-state',
  inputSchema: z.object({ iteration: z.number() }),
  outputSchema: z.object({ iterations: z.number(), stateCount: z.number(), stateLog: z.array(z.string()) }),
  stateSchema,
  execute: async ({ inputData, state }) => {
    return {
      iterations: inputData.iteration,
      stateCount: state?.count ?? 0,
      stateLog: state?.log ?? [],
    };
  },
});

export const stateLoopWorkflow = createWorkflow({
  id: 'state-loop-workflow',
  inputSchema: z.object({ iteration: z.number() }),
  outputSchema: z.object({ iterations: z.number(), stateCount: z.number(), stateLog: z.array(z.string()) }),
  stateSchema,
})
  .dowhile(loopWithState, async ({ inputData }) => inputData.iteration < 3)
  .then(readLoopState)
  .commit();

// --- state-parallel-workflow ---
// Tests state in parallel branches — each branch modifies state independently.
const parallelBranchAlpha = createStep({
  id: 'parallel-branch-alpha',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ alpha: z.number() }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    await setState({
      count: (state?.count ?? 0) + 1,
      log: [...(state?.log ?? []), 'alpha'],
    });
    return { alpha: inputData.value * 2 };
  },
});

const parallelBranchBeta = createStep({
  id: 'parallel-branch-beta',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ beta: z.number() }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    await setState({
      count: (state?.count ?? 0) + 1,
      log: [...(state?.log ?? []), 'beta'],
    });
    return { beta: inputData.value * 3 };
  },
});

export const stateParallelWorkflow = createWorkflow({
  id: 'state-parallel-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ alpha: z.number(), beta: z.number() }),
  stateSchema,
})
  .parallel([parallelBranchAlpha, parallelBranchBeta])
  .commit();
