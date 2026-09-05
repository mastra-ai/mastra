import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { createWorkflow, createEventedWorkflow } from './create';
import { createStep } from './workflow';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

const instances: Mastra[] = [];
afterEach(async () => {
  await Promise.all(instances.splice(0).map(mastra => mastra.stopWorkers()));
});

function fixture(evented = false) {
  const storage = new InMemoryStore();
  const entered = deferred();
  const release = deferred();
  const execute = vi.fn(
    async ({
      inputData,
      state,
      requestContext,
    }: {
      inputData: { item: string };
      state: any;
      requestContext: RequestContext;
    }) => {
      entered.resolve();
      await release.promise;
      return { ...inputData, total: state.total, tenant: requestContext.get('tenant') };
    },
  );
  const onStart = vi.fn();
  const ready: Promise<void>[] = [];
  const replica = () => {
    const step = createStep({
      id: 'work',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), total: z.number(), tenant: z.string() }),
      execute,
    });
    const workflow = (evented ? createEventedWorkflow : createWorkflow)({
      id: 'concurrent-start',
      inputSchema: step.inputSchema,
      outputSchema: step.outputSchema,
      stateSchema: z.object({ total: z.number() }),
      options: { onStart },
    })
      .then(step)
      .commit();
    const mastra = new Mastra({ storage, workflows: { [workflow.id]: workflow }, logger: false });
    instances.push(mastra);
    if (evented) ready.push(mastra.startWorkers());
    return workflow;
  };
  const args = {
    inputData: { item: 'widget' },
    initialState: { total: 7 },
    requestContext: new RequestContext([['tenant', 'one']]),
  };
  return { storage, entered, release, execute, onStart, replica, args, ready };
}

describe('concurrent workflow starts', () => {
  it('claims evented starts across instances and rejects repeated terminal starts', async () => {
    const f = fixture(true);
    const runs = await Promise.all([
      f.replica().createRun({ runId: 'evented-shared' }),
      f.replica().createRun({ runId: 'evented-shared' }),
    ]);
    await Promise.all(f.ready);
    const resultsPromise = Promise.allSettled(runs.map(run => run.start(f.args)));
    try {
      await f.entered.promise;
    } finally {
      f.release.resolve();
    }
    const results = await resultsPromise;
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(results.find(result => result.status === 'fulfilled')).toMatchObject({ value: { status: 'success' } });
    expect(results.find(result => result.status === 'rejected')).toMatchObject({
      reason: { id: 'WORKFLOW_START_ALREADY_CLAIMED' },
    });
    await expect(runs[0]!.start(f.args)).rejects.toMatchObject({ id: 'WORKFLOW_START_ALREADY_CLAIMED' });
  }, 15000);

  it('recovers an evented run claimed before its first event was published', async () => {
    const f = fixture(true);
    const workflow = f.replica();
    const run = await workflow.createRun({ runId: 'evented-crash' });
    await Promise.all(f.ready);
    vi.spyOn(workflow.executionEngine, 'execute').mockRejectedValueOnce(new Error('process stopped'));
    await expect(run.start(f.args)).rejects.toThrow('process stopped');
    expect(f.execute).not.toHaveBeenCalled();
    f.release.resolve();
    const recovered = await f.replica().createRun({ runId: 'evented-crash' });
    await Promise.all(f.ready);
    expect(await recovered.restart()).toMatchObject({
      status: 'success',
      result: { item: 'widget', total: 7, tenant: 'one' },
    });
    expect(f.execute).toHaveBeenCalledTimes(1);
  }, 15000);

  it('allows only one start across separate workflow instances sharing storage', async () => {
    const f = fixture();
    const runs = await Promise.all([
      f.replica().createRun({ runId: 'shared' }),
      f.replica().createRun({ runId: 'shared' }),
    ]);
    const resultsPromise = Promise.allSettled(runs.map(run => run.start(f.args)));
    try {
      await f.entered.promise;
    } finally {
      f.release.resolve();
    }
    const results = await resultsPromise;
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({
      reason: { id: 'WORKFLOW_START_ALREADY_CLAIMED' },
    });
  });

  it('rejects redelivery after completion without replacing the saved result', async () => {
    const f = fixture();
    f.release.resolve();
    const first = await f.replica().createRun({ runId: 'completed' });
    expect(await first.start(f.args)).toMatchObject({ status: 'success' });
    const next = await f.replica().createRun({ runId: 'completed' });
    await expect(next.start(f.args)).rejects.toMatchObject({ id: 'WORKFLOW_START_ALREADY_CLAIMED' });
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it('keeps a run available after input validation or onStart rejects', async () => {
    const f = fixture();
    f.release.resolve();
    const run = await f.replica().createRun({ runId: 'retry-gate' });
    await expect(run.start({ ...f.args, inputData: { item: 3 as unknown as string } })).rejects.toThrow();
    f.onStart.mockRejectedValueOnce(new Error('quota denied'));
    await expect(run.start(f.args)).rejects.toThrow('quota denied');
    expect(await run.start(f.args)).toMatchObject({
      status: 'success',
      result: { item: 'widget', total: 7, tenant: 'one' },
    });
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it('does not let a delayed initial snapshot overwrite an already running replica', async () => {
    const f = fixture();
    const store = (await f.storage.getStore('workflows'))!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    const createEntered = deferred();
    const releaseCreate = deferred();
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementationOnce(async args => {
      createEntered.resolve();
      await releaseCreate.promise;
      await persist(args);
    });
    const slow = f.replica().createRun({ runId: 'late-create' });
    await createEntered.promise;
    const fast = await f.replica().createRun({ runId: 'late-create' });
    const executing = fast.start(f.args);
    try {
      await f.entered.promise;
      releaseCreate.resolve();
      const delayed = await slow;
      const snapshot = await store.loadWorkflowSnapshot({ workflowName: 'concurrent-start', runId: 'late-create' });
      expect(snapshot?.status).toBe('running');
      await expect(delayed.start(f.args)).rejects.toMatchObject({ id: 'WORKFLOW_START_ALREADY_CLAIMED' });
    } finally {
      releaseCreate.resolve();
      f.release.resolve();
      await executing;
    }
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it('recovers original input, state and context after a crash immediately following the claim', async () => {
    const f = fixture();
    const workflow = f.replica();
    const run = await workflow.createRun({ runId: 'crash-before-first-step' });
    vi.spyOn(workflow.executionEngine, 'execute').mockRejectedValueOnce(new Error('process stopped'));
    await expect(run.start(f.args)).rejects.toThrow('process stopped');
    expect(f.execute).not.toHaveBeenCalled();
    f.release.resolve();
    const recovered = await f.replica().createRun({ runId: 'crash-before-first-step' });
    expect(await recovered.restart()).toMatchObject({
      status: 'success',
      result: { item: 'widget', total: 7, tenant: 'one' },
    });
    expect(f.execute).toHaveBeenCalledTimes(1);
  });
});
