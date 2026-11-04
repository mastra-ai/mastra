import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
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

/**
 * Asserts a storage v2 result holds no successful payload: every successful step is a stub, and
 * only `input` and the non-successful results (which readers use synchronously) stay whole.
 */
function expectOnlyStubs(result: { steps: unknown }, kept: string[] = []) {
  const resident = residentStepResults(result.steps)!;
  expect(resident).toBeDefined();
  const whole = Object.keys(resident).filter(
    stepId => stepId !== 'input' && resident[stepId]?.status === 'success' && !isStepResultStub(resident[stepId]),
  );
  expect(whole).toEqual([]);
  const nonSuccess = Object.keys(resident).filter(
    stepId => stepId !== 'input' && resident[stepId]?.status !== 'success',
  );
  expect(nonSuccess.sort()).toEqual([...kept].sort());
  return resident;
}

const fullChain = {
  step1: { status: 'success', output: { n: 1 } },
  step2: { status: 'success', output: { n: 2 } },
  step3: { status: 'success', output: { n: 3 } },
  step4: { status: 'success', output: { n: 4 } },
};

describe('storage v2 result steps loader', () => {
  it.each(['resume', 'delete', 'recreate'] as const)(
    'rejects stale suspended results without successful steps after %s',
    async change => {
      const workflow = createWorkflow({
        id: `gate-only-${change}`,
        inputSchema: num,
        outputSchema: num,
        options: { storageVersion: 2 },
      })
        .then(approve('gate'))
        .commit();
      const storage = host(workflow);
      const { reads } = recordStepReads(storage);
      const run = await workflow.createRun();
      const suspended = await run.start({ inputData: { n: 0 } });
      expect(suspended.status).toBe('suspended');
      expect(reads).toEqual([]);
      expect(Object.values(residentStepResults(suspended.steps)!).some(isStepResultStub)).toBe(false);

      if (change === 'resume') {
        const resumed = await run.resume({ step: 'gate', resumeData: true });
        expect(resumed.status).toBe('success');
      } else {
        await workflow.deleteWorkflowRunById(run.runId);
        if (change === 'recreate') {
          const replacement = await workflow.createRun({ runId: run.runId });
          const current = await replacement.start({ inputData: { n: 9 } });
          expect(await current.steps()).toMatchObject({ input: { n: 9 }, gate: { status: 'suspended' } });
        }
      }

      await expect(suspended.steps()).rejects.toMatchObject({ id: 'WORKFLOW_STORAGE_V2_STEPS_STALE' });
    },
  );

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
    const resident = expectOnlyStubs(result);
    expect(
      Object.keys(resident)
        .filter(stepId => isStepResultStub(resident[stepId]))
        .sort(),
    ).toEqual(['step1', 'step2', 'step3', 'step4']);
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

  it.each(['start', 'restart'] as const)(
    'never exposes a recreated run’s results through an earlier %s result with the same sequence',
    async operation => {
      const workflow = createWorkflow({
        id: 'reused-run',
        inputSchema: num,
        outputSchema: num,
        options: { storageVersion: 2 },
      })
        .then(addOne('step'))
        .commit();
      const storage = new InMemoryStore();
      new Mastra({ logger: false, storage, workflows: { workflow } });
      const run = await workflow.createRun({ runId: 'reused' });
      const initial = await run.start({ inputData: { n: 0 } });
      const oldResult = operation === 'restart' ? await run.restart() : initial;
      const store = (await storage.getStore('workflows'))!;
      const oldHeader = await store.loadWorkflowRunHeader({ workflowName: workflow.id, runId: run.runId });

      await workflow.deleteWorkflowRunById(run.runId);
      const replacement = await workflow.createRun({ runId: run.runId });
      const newResult = await replacement.start({ inputData: { n: 9 } });
      const newHeader = await store.loadWorkflowRunHeader({ workflowName: workflow.id, runId: replacement.runId });

      expect(newHeader!.lastSeq).toBe(oldHeader!.lastSeq);
      await expect(oldResult.steps()).rejects.toMatchObject({ id: 'WORKFLOW_STORAGE_V2_STEPS_STALE' });
      expect(await newResult.steps()).toMatchObject({ input: { n: 9 }, step: { output: { n: 10 } } });
    },
  );

  it('never hydrates a nested run’s result from a replacement run with the same sequence', async () => {
    let nestedRunId!: string;
    let nestedSteps!: () => Promise<unknown>;
    const inner = createWorkflow({
      id: 'nested-reused-run',
      inputSchema: num,
      outputSchema: num,
      options: {
        storageVersion: 2,
        onFinish: result => {
          nestedRunId = result.runId;
          nestedSteps = result.steps;
        },
      },
    })
      .then(addOne('step'))
      .commit();
    const outer = createWorkflow({ id: 'parent', inputSchema: num, outputSchema: num, options: { storageVersion: 2 } })
      .then(inner)
      .commit();
    const storage = new InMemoryStore();
    new Mastra({ logger: false, storage, workflows: { outer, inner } });
    const parent = await outer.createRun({ runId: 'reused' });
    await parent.start({ inputData: { n: 0 } });
    const oldSteps = nestedSteps;
    const oldRunId = nestedRunId;
    const store = (await storage.getStore('workflows'))!;
    const oldHeader = await store.loadWorkflowRunHeader({ workflowName: inner.id, runId: oldRunId });

    await inner.deleteWorkflowRunById(oldRunId);
    await outer.deleteWorkflowRunById(parent.runId);
    const replacement = await outer.createRun({ runId: parent.runId });
    await replacement.start({ inputData: { n: 9 } });
    const newHeader = await store.loadWorkflowRunHeader({ workflowName: inner.id, runId: nestedRunId });

    expect(nestedRunId).toBe(oldRunId);
    expect(newHeader!.lastSeq).toBe(oldHeader!.lastSeq);
    await expect(oldSteps()).rejects.toMatchObject({ id: 'WORKFLOW_STORAGE_V2_STEPS_STALE' });
    expect(await nestedSteps()).toMatchObject({ input: { n: 9 }, step: { output: { n: 10 } } });
  });

  it('never exposes a later resume’s results through an earlier result', async () => {
    const workflow = chain(2, { gate: true });
    const storage = host(workflow);
    const run = await workflow.createRun();
    const suspended = await run.start({ inputData: { n: 0 } });
    expect(suspended.status).toBe('suspended');
    const resident = expectOnlyStubs(suspended, ['gate']);
    expect(resident.gate).toMatchObject({ status: 'suspended' });

    const { reads } = recordStepReads(storage);
    const resumed = await run.resume({ step: 'gate', resumeData: true });
    expect(resumed.status).toBe('success');
    // Only the resumed step's input is read to execute it; returning the result reads nothing more.
    expect(reads).toEqual([['step4']]);
    expectOnlyStubs(resumed);

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
    expect(expectOnlyStubs(result, ['boom']).boom).toMatchObject({ status: 'failed' });
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
    expectOnlyStubs(travelled);

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
    expectOnlyStubs(result);
    expect(reads.flat().filter(stepId => stepId.startsWith('inner'))).toEqual([]);
    const steps = await (result.steps as unknown as () => Promise<Record<string, any>>)();
    expect(steps.inner).toMatchObject({ status: 'success', output: { n: 5 } });
    expect(reads.flat().filter(stepId => stepId.startsWith('inner') && stepId !== 'inner')).toEqual([]);
  });

  it('restart of a finished run returns a loader that holds only stubs', async () => {
    const workflow = chain(2);
    const storage = host(workflow);
    const run = await workflow.createRun();
    await run.start({ inputData: { n: 0 } });

    const { reads } = recordStepReads(storage);
    const store = storage.stores.workflows!;
    const load = store.loadWorkflowRun.bind(store);
    const fullReads: string[] = [];
    store.loadWorkflowRun = async args => {
      if (args.successfulSteps === 'full') fullReads.push(args.runId);
      return load(args);
    };
    const restarted = await (await workflow.createRun({ runId: run.runId })).restart();
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual({ n: 4 });
    expectOnlyStubs(restarted);
    expect(fullReads).toEqual([]);
    expect(reads).toEqual([]);
    expect(await (restarted.steps as unknown as () => Promise<unknown>)()).toMatchObject(fullChain);
    expect(reads).toHaveLength(1);
  });

  it('cancel returns a loader that holds only stubs', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    let workflow: any = createWorkflow({
      id: 'cancelled',
      inputSchema: num,
      outputSchema: num,
      options: { storageVersion: 2 },
    });
    for (let i = 1; i <= 4; i++) workflow = workflow.then(addOne(`step${i}`));
    let entered!: () => void;
    const waiting = new Promise<void>(resolve => (entered = resolve));
    workflow = workflow
      .then(
        createStep({
          id: 'wait',
          inputSchema: num,
          outputSchema: num,
          execute: async ({ inputData, abortSignal }) => {
            entered();
            await Promise.race([gate, new Promise(resolve => abortSignal.addEventListener('abort', resolve))]);
            return inputData;
          },
        }),
      )
      .commit();
    const storage = host(workflow);
    const run = await workflow.createRun();
    const started = run.start({ inputData: { n: 0 } });
    await waiting;
    await run.cancel();
    release();
    const result = await started;

    expect(result.status).toBe('canceled');
    expectOnlyStubs(result);
    const { reads } = recordStepReads(storage);
    expect(await (result.steps as unknown as () => Promise<unknown>)()).toMatchObject(fullChain);
    expect(reads).toHaveLength(1);
  });

  it('a perStep run returns its paused result as a loader without reading', async () => {
    const workflow = chain(2);
    const storage = host(workflow);
    const { reads } = recordStepReads(storage);
    const run = await workflow.createRun();

    const paused = await run.start({ inputData: { n: 0 }, perStep: true });
    expect(paused.status).toBe('paused');
    expect(typeof paused.steps).toBe('function');
    expect(reads).toEqual([]);
    expect(Object.keys(expectOnlyStubs(paused))).toContain('step1');

    expect(await (paused.steps as unknown as () => Promise<unknown>)()).toMatchObject({ step1: fullChain.step1 });
    expect(reads).toHaveLength(1);
  });

  it('time travel stubs the steps it re-ran in its result, and makes an earlier result stale', async () => {
    const workflow = chain(2);
    const storage = host(workflow);
    const run = await workflow.createRun();
    const original = await run.start({ inputData: { n: 0 } });

    const travelled = await run.timeTravel({ step: 'step3', inputData: { n: 10 } });
    const resident = expectOnlyStubs(travelled);
    expect(isStepResultStub(resident.step3)).toBe(true);
    expect(isStepResultStub(resident.step4)).toBe(true);

    // `original.steps()` was never called before the time travel, so it has nothing cached.
    await expect((original.steps as unknown as () => Promise<unknown>)()).rejects.toMatchObject({
      id: 'WORKFLOW_STORAGE_V2_STEPS_STALE',
    });
    const { reads } = recordStepReads(storage);
    expect(await (travelled.steps as unknown as () => Promise<unknown>)()).toMatchObject({
      step3: { status: 'success', output: { n: 11 } },
      step4: { status: 'success', output: { n: 12 } },
    });
    expect(reads).toHaveLength(1);
  });
});
