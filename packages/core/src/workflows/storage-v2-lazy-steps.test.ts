import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { isStepResultStub, residentStepResults } from './run-journal';
import { createStep } from './workflow';
import type { AnyWorkflow } from './workflow';

const num = z.object({ n: z.number() });

function addOne(id: string) {
  return createStep({
    id,
    inputSchema: num,
    outputSchema: num,
    execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
  });
}

function approve(id: string) {
  return createStep({
    id,
    inputSchema: num,
    outputSchema: num,
    resumeSchema: z.boolean(),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (resumeData === undefined) return suspend({});
      return { n: inputData.n + 1 };
    },
  });
}

/** step1..step4, each adding one: the earlier steps' results are evicted by the end of the run. */
function chain(
  storageVersion: 1 | 2,
  { id = 'chain', gate = false, onFinish }: { id?: string; gate?: boolean; onFinish?: (result: any) => unknown } = {},
) {
  let workflow: any = createWorkflow({
    id,
    inputSchema: num,
    outputSchema: num,
    options: { storageVersion, ...(onFinish && { onFinish }) },
  });
  for (let i = 1; i <= 4; i++) workflow = workflow.then(addOne(`step${i}`));
  if (gate) workflow = workflow.then(approve('gate'));
  return workflow.commit() as AnyWorkflow;
}

/** Records the step ids of each `loadWorkflowRunSteps` call. */
function recordStepReads(storage: MockStore) {
  const store = storage.stores.workflows!;
  const reads: string[][] = [];
  const load = store.loadWorkflowRunSteps.bind(store);
  store.loadWorkflowRunSteps = async args => {
    reads.push([...args.stepIds]);
    return load(args);
  };
  return { reads };
}

function host(workflow: AnyWorkflow, storage = new MockStore()) {
  new Mastra({ logger: false, storage, workflows: { [workflow.id]: workflow } });
  return storage;
}

const fullChain = {
  step1: { status: 'success', output: { n: 1 } },
  step2: { status: 'success', output: { n: 2 } },
  step3: { status: 'success', output: { n: 3 } },
  step4: { status: 'success', output: { n: 4 } },
};

describe('storage v2 result steps loader', () => {
  it('keeps a v1 result’s steps a record', async () => {
    const workflow = chain(1);
    host(workflow);
    const result = await (await workflow.createRun()).start({ inputData: { n: 0 } });

    expect(typeof result.steps).toBe('object');
    expect(result.steps).toMatchObject(fullChain);
    expect(residentStepResults(result.steps)).toBeUndefined();
  });

  it('returns the result without reading evicted steps, and holds only their stubs', async () => {
    const workflow = chain(2);
    const storage = host(workflow);
    const { reads } = recordStepReads(storage);

    const result = await (await workflow.createRun()).start({ inputData: { n: 0 } });

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ n: 4 });
    expect(typeof result.steps).toBe('function');
    expect(reads).toEqual([]);
    const resident = residentStepResults(result.steps)!;
    const stubbed = Object.keys(resident).filter(stepId => isStepResultStub(resident[stepId]));
    expect(stubbed.length).toBeGreaterThan(0);
    // The resident results survive spreading the result, as the framework's readers do.
    expect(residentStepResults({ ...result }.steps)).toBe(resident);
  });

  it('shares one read between concurrent and repeated calls', async () => {
    const workflow = chain(2);
    const storage = host(workflow);
    const { reads } = recordStepReads(storage);
    const result = await (await workflow.createRun()).start({ inputData: { n: 0 } });
    const steps = result.steps as unknown as () => Promise<Record<string, unknown>>;

    const [a, b] = await Promise.all([steps(), steps()]);
    const c = await steps();

    expect(reads).toHaveLength(1);
    expect(a).toBe(b);
    expect(c).toBe(a);
    expect(a).toMatchObject(fullChain);
  });

  it('surfaces a failed read and retries it on the next call', async () => {
    const workflow = chain(2);
    const storage = host(workflow);
    const { reads } = recordStepReads(storage);
    const result = await (await workflow.createRun()).start({ inputData: { n: 0 } });
    const steps = result.steps as unknown as () => Promise<Record<string, unknown>>;

    const store = storage.stores.workflows!;
    const recorded = store.loadWorkflowRunSteps;
    store.loadWorkflowRunSteps = vi.fn().mockRejectedValueOnce(new Error('storage down'));
    await expect(steps()).rejects.toThrow('storage down');

    store.loadWorkflowRunSteps = recorded;
    expect(await steps()).toMatchObject(fullChain);
    expect(reads).toHaveLength(1);
  });

  it('fails with WORKFLOW_STORAGE_V2_STEP_RESULT_MISSING when a stubbed step has no stored row', async () => {
    const workflow = chain(2);
    const storage = host(workflow);
    const result = await (await workflow.createRun()).start({ inputData: { n: 0 } });

    storage.stores.workflows!.loadWorkflowRunSteps = async () => ({});
    await expect((result.steps as unknown as () => Promise<unknown>)()).rejects.toMatchObject({
      id: 'WORKFLOW_STORAGE_V2_STEP_RESULT_MISSING',
    });
  });

  it('fails with WORKFLOW_STORAGE_V2_STEPS_STALE once the run is deleted', async () => {
    const workflow = chain(2);
    const storage = host(workflow);
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { n: 0 } });

    await storage.stores.workflows!.deleteWorkflowRunById({ workflowName: workflow.id, runId: run.runId });
    await expect((result.steps as unknown as () => Promise<unknown>)()).rejects.toMatchObject({
      id: 'WORKFLOW_STORAGE_V2_STEPS_STALE',
    });
  });

  it('never exposes a later resume’s results through an earlier result', async () => {
    const workflow = chain(2, { gate: true });
    const storage = host(workflow);
    const run = await workflow.createRun();
    const suspended = await run.start({ inputData: { n: 0 } });
    expect(suspended.status).toBe('suspended');

    const { reads } = recordStepReads(storage);
    const resumed = await run.resume({ step: 'gate', resumeData: true });
    expect(resumed.status).toBe('success');
    // Only the resumed step's input is read to execute it; returning the result reads nothing more.
    expect(reads).toEqual([['step4']]);

    await expect((suspended.steps as unknown as () => Promise<unknown>)()).rejects.toMatchObject({
      id: 'WORKFLOW_STORAGE_V2_STEPS_STALE',
    });
    const steps = await (resumed.steps as unknown as () => Promise<Record<string, any>>)();
    expect(steps).toMatchObject({ ...fullChain, gate: { status: 'success', output: { n: 5 } } });
  });

  it('lets onFinish await steps() without deadlocking the run', async () => {
    let finished: Record<string, unknown> | undefined;
    const workflow = chain(2, {
      onFinish: async ({ steps }: { steps: () => Promise<Record<string, unknown>> }) => {
        finished = await steps();
      },
    });
    host(workflow);

    const result = await (await workflow.createRun()).start({ inputData: { n: 0 } });

    expect(result.status).toBe('success');
    expect(finished).toMatchObject(fullChain);
  });

  it('lets onError await steps() of a failed run', async () => {
    let failed: Record<string, any> | undefined;
    let workflow: any = createWorkflow({
      id: 'failing',
      inputSchema: num,
      outputSchema: num,
      options: {
        storageVersion: 2,
        onError: async ({ steps }: { steps: () => Promise<Record<string, unknown>> }) => {
          failed = await steps();
        },
      },
    });
    for (let i = 1; i <= 4; i++) workflow = workflow.then(addOne(`step${i}`));
    workflow = workflow
      .then(
        createStep({
          id: 'boom',
          inputSchema: num,
          outputSchema: num,
          execute: async () => {
            throw new Error('boom');
          },
        }),
      )
      .commit();
    const storage = host(workflow);
    const { reads } = recordStepReads(storage);

    const result = await (await workflow.createRun()).start({ inputData: { n: 0 } });

    expect(result.status).toBe('failed');
    expect(result.error).toMatchObject({ message: 'boom' });
    expect(failed).toMatchObject({ ...fullChain, boom: { status: 'failed' } });
    expect(reads).toHaveLength(1);
  });

  it('time travel returns a loader without reading evicted steps', async () => {
    const workflow = chain(2);
    const storage = host(workflow);
    const run = await workflow.createRun();
    await run.start({ inputData: { n: 0 } });

    const { reads } = recordStepReads(storage);
    const travelled = await run.timeTravel({ step: 'step3', inputData: { n: 10 } });
    expect(travelled.status).toBe('success');
    expect(travelled.result).toEqual({ n: 12 });
    expect(typeof travelled.steps).toBe('function');
    expect(reads).toEqual([]);

    const steps = await (travelled.steps as unknown as () => Promise<Record<string, any>>)();
    expect(steps).toMatchObject({
      step3: { status: 'success', output: { n: 11 } },
      step4: { status: 'success', output: { n: 12 } },
    });
    expect(reads).toHaveLength(1);
  });

  it('hands a nested run back without reading its steps', async () => {
    const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, options: { storageVersion: 2 } })
      .then(addOne('inner1'))
      .then(addOne('inner2'))
      .then(addOne('inner3'))
      .then(addOne('inner4'))
      .commit();
    const outer = createWorkflow({ id: 'outer', inputSchema: num, outputSchema: num, options: { storageVersion: 2 } })
      .then(addOne('before'))
      .then(inner)
      .then(addOne('after'))
      .commit();
    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { outer, inner } });
    const { reads } = recordStepReads(storage);

    const result = await (await outer.createRun()).start({ inputData: { n: 0 } });

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ n: 6 });
    expect(reads.flat().filter(stepId => stepId.startsWith('inner'))).toEqual([]);
    const steps = await (result.steps as unknown as () => Promise<Record<string, any>>)();
    expect(steps.inner).toMatchObject({ status: 'success', output: { n: 5 } });
    expect(reads.flat().filter(stepId => stepId.startsWith('inner') && stepId !== 'inner')).toEqual([]);
  });
});
