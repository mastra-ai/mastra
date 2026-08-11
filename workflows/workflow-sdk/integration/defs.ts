import { Mastra } from '@mastra/core';
import { MockStore } from '@mastra/core/storage';
import { z } from 'zod';
import { init } from '../src/index';
import { mastraRunner } from '../src/workflows/index';

/**
 * Mastra workflow definitions used by the integration tests.
 *
 * This file stands in for a consumer's `src/mastra` entrypoint: it calls
 * `init()` once and defines workflows at module scope, so importing it is what
 * populates the registry that steps read from.
 */
const { createWorkflow, createStep } = init({ runner: mastraRunner });

const numberIn = z.object({ value: z.number() });

const increment = createStep({
  id: 'increment',
  inputSchema: numberIn,
  outputSchema: numberIn,
  execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
});

const double = createStep({
  id: 'double',
  inputSchema: numberIn,
  outputSchema: numberIn,
  execute: async ({ inputData }) => ({ value: inputData.value * 2 }),
});

export const chainWorkflow = createWorkflow({
  id: 'chain-workflow',
  inputSchema: numberIn,
  outputSchema: numberIn,
})
  .then(increment)
  .then(double)
  .commit();

// --- parallel -------------------------------------------------------------

const addTen = createStep({
  id: 'add-ten',
  inputSchema: numberIn,
  outputSchema: numberIn,
  execute: async ({ inputData }) => ({ value: inputData.value + 10 }),
});

const addTwenty = createStep({
  id: 'add-twenty',
  inputSchema: numberIn,
  outputSchema: numberIn,
  execute: async ({ inputData }) => ({ value: inputData.value + 20 }),
});

export const parallelWorkflow = createWorkflow({
  id: 'parallel-workflow',
  inputSchema: numberIn,
  outputSchema: z.object({
    'add-ten': numberIn,
    'add-twenty': numberIn,
  }),
})
  .parallel([addTen, addTwenty])
  .commit();

// --- branch ---------------------------------------------------------------

const markSmall = createStep({
  id: 'mark-small',
  inputSchema: numberIn,
  outputSchema: z.object({ label: z.string() }),
  execute: async () => ({ label: 'small' }),
});

const markLarge = createStep({
  id: 'mark-large',
  inputSchema: numberIn,
  outputSchema: z.object({ label: z.string() }),
  execute: async () => ({ label: 'large' }),
});

export const branchWorkflow = createWorkflow({
  id: 'branch-workflow',
  inputSchema: numberIn,
  outputSchema: z.record(z.string(), z.any()),
})
  .branch([
    [async ({ inputData }) => inputData.value < 10, markSmall],
    [async ({ inputData }) => inputData.value >= 10, markLarge],
  ])
  .commit();

// --- dountil --------------------------------------------------------------

export const loopWorkflow = createWorkflow({
  id: 'loop-workflow',
  inputSchema: numberIn,
  outputSchema: numberIn,
})
  .dountil(increment, async ({ inputData }) => inputData.value >= 5)
  .commit();

// --- foreach --------------------------------------------------------------

const squareStep = createStep({
  id: 'square',
  inputSchema: numberIn,
  outputSchema: numberIn,
  execute: async ({ inputData }) => ({ value: inputData.value * inputData.value }),
});

const fanOut = createStep({
  id: 'fan-out',
  inputSchema: numberIn,
  outputSchema: z.array(numberIn),
  execute: async ({ inputData }) => Array.from({ length: inputData.value }, (_unused, index) => ({ value: index + 1 })),
});

export const foreachWorkflow = createWorkflow({
  id: 'foreach-workflow',
  inputSchema: numberIn,
  outputSchema: z.array(numberIn),
})
  .then(fanOut)
  .foreach(squareStep, { concurrency: 2 })
  .commit();

// --- sleep ----------------------------------------------------------------

export const sleepWorkflow = createWorkflow({
  id: 'sleep-workflow',
  inputSchema: numberIn,
  outputSchema: numberIn,
})
  .then(increment)
  .sleep(60_000)
  .then(double)
  .commit();

// --- suspend / resume -----------------------------------------------------

const approval = createStep({
  id: 'approval',
  inputSchema: numberIn,
  outputSchema: z.object({ approved: z.boolean(), value: z.number() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ question: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({ question: `Approve ${inputData.value}?` });
      return { approved: false, value: inputData.value };
    }
    return { approved: resumeData.approved, value: inputData.value };
  },
});

export const suspendWorkflow = createWorkflow({
  id: 'suspend-workflow',
  inputSchema: numberIn,
  outputSchema: z.object({ approved: z.boolean(), value: z.number() }),
})
  .then(increment)
  .then(approval)
  .commit();

// --- state ----------------------------------------------------------------

const writeState = createStep({
  id: 'write-state',
  inputSchema: numberIn,
  outputSchema: numberIn,
  stateSchema: z.object({ seen: z.number() }),
  execute: async ({ inputData, setState }) => {
    await setState({ seen: inputData.value });
    return inputData;
  },
});

const readState = createStep({
  id: 'read-state',
  inputSchema: numberIn,
  outputSchema: z.object({ seen: z.number() }),
  stateSchema: z.object({ seen: z.number() }),
  execute: async ({ state }) => ({ seen: state.seen }),
});

export const stateWorkflow = createWorkflow({
  id: 'state-workflow',
  inputSchema: numberIn,
  outputSchema: z.object({ seen: z.number() }),
  stateSchema: z.object({ seen: z.number() }),
})
  .then(writeState)
  .then(readState)
  .commit();

// --- external cancellation ------------------------------------------------

/**
 * Observed from the test: the step runs on the host in this same process, so
 * module state is how the test sees inside an execution whose result never
 * comes back (the run is canceled before it settles).
 */
export const slowStepObserved = { started: false, abortFired: false };

const slowStep = createStep({
  id: 'slow-step',
  inputSchema: numberIn,
  outputSchema: numberIn,
  execute: async ({ inputData, abortSignal }) => {
    slowStepObserved.started = true;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 15_000);
      abortSignal.addEventListener('abort', () => {
        clearTimeout(timer);
        slowStepObserved.abortFired = true;
        reject(new Error('slow step aborted'));
      });
    });
    return inputData;
  },
});

export const slowWorkflow = createWorkflow({
  id: 'slow-workflow',
  inputSchema: numberIn,
  outputSchema: numberIn,
})
  .then(slowStep)
  .commit();

// --- failure --------------------------------------------------------------

const alwaysFails = createStep({
  id: 'always-fails',
  inputSchema: numberIn,
  outputSchema: numberIn,
  execute: async () => {
    throw new Error('step blew up');
  },
});

export const failingWorkflow = createWorkflow({
  id: 'failing-workflow',
  inputSchema: numberIn,
  outputSchema: numberIn,
})
  .then(alwaysFails)
  .commit();

// --- the Mastra instance --------------------------------------------------

/**
 * Registering the workflows on a `Mastra` instance gives them storage, which is
 * what lets a run be resumed, watched or cancelled from a process other than
 * the one that started it. `MockStore` is in-memory; a real app would use a
 * persistent store.
 */
export const mastra = new Mastra({
  logger: false,
  storage: new MockStore(),
  workflows: {
    chainWorkflow,
    parallelWorkflow,
    branchWorkflow,
    loopWorkflow,
    foreachWorkflow,
    sleepWorkflow,
    suspendWorkflow,
    stateWorkflow,
    failingWorkflow,
    slowWorkflow,
  },
});
