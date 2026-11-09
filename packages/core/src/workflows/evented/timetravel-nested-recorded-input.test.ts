import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createTimeTravelExecutionParams } from '../utils';
import { createStep, createWorkflow } from '.';

// See https://github.com/mastra-ai/mastra/issues/29735.
const withTimeout = <T>(promise: Promise<T>, ms = 5000) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`did not settle within ${ms}ms`)), ms)),
  ]);

describe('evented time travel into a nested workflow step', () => {
  it('re-runs the nested step with its recorded input', async () => {
    const schema = z.object({ customer: z.string().optional(), order: z.number().optional() });
    const inputs: unknown[] = [];
    let failures = 0;

    const prepare = createStep({
      id: 'prepare',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => ({ ...inputData, order: 42 }),
    });
    const charge = createStep({
      id: 'charge',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => {
        inputs.push(inputData);
        if (failures++ === 0) throw new Error('transient failure');
        return inputData;
      },
    });
    const inner = createWorkflow({ id: 'inner', inputSchema: schema, outputSchema: schema })
      .then(prepare)
      .then(charge)
      .commit();
    const outer = createWorkflow({ id: 'outer', inputSchema: schema, outputSchema: schema }).then(inner).commit();

    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { outer, inner },
    });

    await mastra.startWorkers();
    try {
      const run = await mastra.getWorkflow('outer').createRun();
      expect((await run.start({ inputData: { customer: 'c1' } })).status).toBe('failed');

      const workflowsStore = (await storage.getStore('workflows'))!;
      const innerRunsBefore = await workflowsStore.listWorkflowRuns({ workflowName: 'inner' });

      const recovered = await withTimeout(run.timeTravel({ step: ['inner', 'charge'] }));

      expect(recovered.status).toBe('success');
      expect(inputs).toEqual([
        { customer: 'c1', order: 42 },
        { customer: 'c1', order: 42 },
      ]);
      // The recorded nested run is reused rather than a new one being created.
      const innerRunsAfter = await workflowsStore.listWorkflowRuns({ workflowName: 'inner' });
      expect(innerRunsAfter.total).toBe(innerRunsBefore.total);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('settles when time travelling to a step inside a nested foreach', async () => {
    const item = z.object({ i: z.number() });
    const inputs: unknown[] = [];
    let failures = 0;

    const list = createStep({
      id: 'list',
      inputSchema: z.object({}),
      outputSchema: z.array(item),
      execute: async () => [{ i: 0 }],
    });
    const work = createStep({
      id: 'work',
      inputSchema: item,
      outputSchema: item,
      execute: async ({ inputData }) => {
        inputs.push(inputData);
        if (failures++ === 0) throw new Error('transient failure');
        return inputData;
      },
    });
    const innerf = createWorkflow({ id: 'innerf', inputSchema: z.object({}), outputSchema: z.array(item) })
      .then(list)
      .foreach(work)
      .commit();
    const outerf = createWorkflow({ id: 'outerf', inputSchema: z.object({}), outputSchema: z.array(item) })
      .then(innerf)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub: new EventEmitterPubSub(),
      workflows: { outerf, innerf },
    });

    await mastra.startWorkers();
    try {
      const run = await mastra.getWorkflow('outerf').createRun();
      expect((await run.start({ inputData: {} })).status).toBe('failed');

      const recovered = await withTimeout(run.timeTravel({ step: ['innerf', 'work'] }));

      expect(recovered.status).toBe('success');
      expect(inputs).toEqual([{ i: 0 }, { i: 0 }]);
    } finally {
      await mastra.stopWorkers();
    }
  });
});

describe('createTimeTravelExecutionParams', () => {
  it('carries only the recorded nested run id into rebuilt step results', () => {
    const step = (id: string) =>
      createStep({ id, inputSchema: z.any(), outputSchema: z.any(), execute: async ({ inputData }) => inputData });
    const inner = createWorkflow({ id: 'inner', inputSchema: z.any(), outputSchema: z.any() })
      .then(step('charge'))
      .commit();
    const outer = createWorkflow({ id: 'outer', inputSchema: z.any(), outputSchema: z.any() })
      .then(step('first'))
      .then(inner)
      .commit();

    const now = Date.now();
    const params = createTimeTravelExecutionParams({
      steps: ['inner', 'charge'],
      graph: outer.buildExecutionGraph(),
      snapshot: {
        runId: 'run-1',
        status: 'failed',
        value: {},
        context: {
          input: {},
          first: {
            status: 'success',
            payload: {},
            output: {},
            startedAt: now,
            endedAt: now,
            metadata: { iterationCount: 2 },
          },
          inner: {
            status: 'failed',
            payload: {},
            startedAt: now,
            endedAt: now,
            metadata: { nestedRunId: 'child-1', iterationCount: 3 },
          },
        } as any,
        serializedStepGraph: [],
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: now,
      },
    });

    expect(params.stepResults.inner).toMatchObject({ status: 'running', metadata: { nestedRunId: 'child-1' } });
    expect((params.stepResults.inner as any).metadata).toEqual({ nestedRunId: 'child-1' });
    expect(params.stepResults.first).not.toHaveProperty('metadata');
  });
});
