import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

// COR-1469: independent workers must not replace a committed occurrence with a stale delivery.
describe('Postgres workflow occurrence guards', () => {
  const schemaName = `step_guard_${Date.now()}`;
  const stores = ['a', 'b'].map(id => new PostgresStore({ ...TEST_CONFIG, id: `step-guard-${id}`, schemaName }));
  const workflowName = 'guarded-workflow';

  beforeAll(async () => {
    for (const store of stores) await store.init();
  });
  afterAll(async () => {
    await stores[0]!.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await Promise.all(stores.map(store => store.close()));
  });

  async function setup() {
    const [a, b] = await Promise.all(stores.map(store => store.getStore('workflows')));
    const runId = randomUUID();
    await a!.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: {
        runId,
        status: 'running',
        context: {},
        value: {},
        activePaths: [],
        activeStepsPath: {},
        serializedStepGraph: [],
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
    });
    const write = (worker: typeof a, eventId: string, expectedStartedBy?: string) =>
      worker!.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step',
        result: { status: 'running', startedAt: 1, payload: {}, metadata: { startedBy: eventId } },
        requestContext: {},
        startGuard: { eventId, expectedStartedBy },
      });
    const finish = (eventId: string, n: number) =>
      a!.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step',
        result: {
          status: 'success',
          payload: {},
          output: n,
          startedAt: 1,
          endedAt: 2,
          metadata: { startedBy: eventId },
        },
        requestContext: { n },
        state: { n },
        completionGuard: { eventId },
      });
    const load = () => a!.loadWorkflowSnapshot({ workflowName, runId });
    return { a, b, runId, write, finish, load };
  }

  it('allows the same interrupted delivery to take over a running occurrence', async () => {
    const { a, b, write, load } = await setup();
    await write(a, 'first');
    await write(b, 'first');
    expect((await load())!.context.step).toMatchObject({ status: 'running', metadata: { startedBy: 'first' } });
  });

  it('does not execute or erase an already completed occurrence on redelivery', async () => {
    const { a, b, write, finish, load } = await setup();
    await write(a, 'first');
    await finish('first', 1);
    const before = await load();
    await expect(write(b, 'first')).rejects.toMatchObject({ code: 'WORKFLOW_STEP_CONFLICT', reason: 'completed' });
    expect(await load()).toEqual(before);
  });

  it('lets one next loop iteration win while rejecting stale and competing starts', async () => {
    const { a, b, write, finish, load } = await setup();
    await write(a, 'first');
    await finish('first', 1);
    const outcomes = await Promise.allSettled([write(a, 'second-a', 'first'), write(b, 'second-b', 'first')]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    const before = await load();
    await expect(write(a, 'old-copy')).rejects.toMatchObject({ code: 'WORKFLOW_STEP_CONFLICT', reason: 'stale' });
    expect(await load()).toEqual(before);
  });

  it('does not rewind state or request context when a committed completion is replayed', async () => {
    const { a, write, finish, load } = await setup();
    await write(a, 'first');
    await finish('first', 1);
    await a!.updateWorkflowResults({
      workflowName,
      runId: (await load())!.runId,
      stepId: 'later',
      result: { status: 'success', payload: {}, output: 2, startedAt: 1, endedAt: 2 },
      requestContext: { n: 2 },
      state: { n: 2 },
    });
    const before = await load();
    await expect(finish('first', 1)).rejects.toMatchObject({ code: 'WORKFLOW_STEP_CONFLICT', reason: 'completed' });
    expect(await load()).toEqual(before);
  });

  it('prunes a control predecessor without rewinding newer state or accepting an older occurrence', async () => {
    const { a, b, runId, write, finish, load } = await setup();
    await write(a, 'first');
    await finish('first', 1);
    const predecessor = (await load())!.context.step;
    await a!.updateWorkflowResults({
      workflowName,
      runId,
      stepId: 'later',
      result: { status: 'success', payload: {}, output: 2, startedAt: 1, endedAt: 2 },
      requestContext: { n: 2 },
      state: { n: 2 },
    });
    const prune = () =>
      b!.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step',
        result: { ...predecessor, output: undefined },
        requestContext: { n: 999 },
        state: { n: 999 },
        completionGuard: { eventId: 'first', pruneOnly: true },
      });
    await prune();
    const pruned = await load();
    expect(pruned!.context.step).toMatchObject({ metadata: { __continuationStarted: true } });
    expect(pruned!.context.step.output).toBeUndefined();
    expect(pruned!.context.__state).toEqual({ n: 2 });
    expect(pruned!.requestContext).toEqual({ n: 2 });
    await prune();
    expect(await load()).toEqual(pruned);
    await expect(finish('first', 999)).rejects.toMatchObject({ reason: 'stale' });
    await write(a, 'second', 'first');
    const newer = await load();
    await expect(prune()).rejects.toMatchObject({ reason: 'stale' });
    expect(await load()).toEqual(newer);
  });

  it('does not let a fresh delivery replace an occurrence still executing on another worker', async () => {
    const { a, b, write, load } = await setup();
    await write(a, 'first');
    const before = await load();
    await expect(write(b, 'competing', 'first')).rejects.toMatchObject({
      code: 'WORKFLOW_STEP_CONFLICT',
      reason: 'stale',
    });
    expect(await load()).toEqual(before);
  });

  it('allows only one delivery to claim a checkpointed restart successor', async () => {
    const { a, b, runId, write, load } = await setup();
    await a!.updateWorkflowResults({
      workflowName,
      runId,
      stepId: 'step',
      requestContext: {},
      result: {
        status: 'running',
        startedAt: 1,
        payload: {},
        metadata: { startedBy: 'restart', __restartPending: true },
      },
    });
    await expect(write(a, 'stale', 'wrong-restart')).rejects.toMatchObject({ reason: 'stale' });
    const outcomes = await Promise.allSettled([write(a, 'successor-a', 'restart'), write(b, 'successor-b', 'restart')]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await load())!.context.step.metadata?.__restartPending).toBeUndefined();
  });

  it('prunes a predecessor only when its successor claims the full input atomically', async () => {
    const { a, b, runId, write, finish, load } = await setup();
    await write(a, 'first');
    await finish('first', 1);
    const predecessor = (await load())!.context.step;
    const claim = (eventId: string) =>
      b!.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'next',
        requestContext: { n: 1 },
        result: { status: 'running', startedAt: 3, payload: 1, metadata: { startedBy: eventId } },
        startGuard: {
          eventId,
          previousStep: { stepId: 'step', eventId: 'first', result: { ...predecessor, output: undefined } },
        },
      });
    await claim('next-first');
    const before = await load();
    expect(before!.context.step.output).toBeUndefined();
    expect(before!.context.next).toMatchObject({ status: 'running', payload: 1 });
    await expect(write(a, 'first')).rejects.toMatchObject({ reason: 'stale' });
    await expect(finish('first', 999)).rejects.toMatchObject({ reason: 'stale' });
    await expect(claim('next-competing')).rejects.toMatchObject({ reason: 'stale' });
    expect(await load()).toEqual(before);

    // An old successor redelivery must not prune a newer occurrence of its predecessor.
    await write(a, 'second', 'first');
    await finish('second', 2);
    await claim('next-first');
    expect((await load())!.context.step).toMatchObject({ output: 2, metadata: { startedBy: 'second' } });
  });

  it('fails explicitly rather than executing a guarded step without its run snapshot', async () => {
    const worker = await stores[0]!.getStore('workflows');
    await expect(
      worker!.updateWorkflowResults({
        workflowName,
        runId: randomUUID(),
        stepId: 'step',
        requestContext: {},
        result: { status: 'running', startedAt: 1, payload: {}, metadata: { startedBy: 'first' } },
        startGuard: { eventId: 'first' },
      }),
    ).rejects.toMatchObject({ code: 'WORKFLOW_STEP_CONFLICT', reason: 'missing' });
  });

  it('preserves legacy records and reports that they need draining before upgrading', async () => {
    const { a, b, runId, write, load } = await setup();
    await a!.updateWorkflowResults({
      workflowName,
      runId,
      stepId: 'step',
      requestContext: {},
      result: { status: 'running', startedAt: 1, payload: {} },
    });
    const before = await load();
    await expect(write(b, 'first')).rejects.toMatchObject({ code: 'WORKFLOW_STEP_CONFLICT', reason: 'legacy' });
    expect(await load()).toEqual(before);
  });

  it('rejects old completions after a later loop iteration has started', async () => {
    const { a, write, finish, load } = await setup();
    await write(a, 'first');
    await finish('first', 1);
    await write(a, 'second', 'first');
    const before = await load();
    await expect(finish('first', 1)).rejects.toMatchObject({ code: 'WORKFLOW_STEP_CONFLICT', reason: 'stale' });
    expect(await load()).toEqual(before);
  });
});
