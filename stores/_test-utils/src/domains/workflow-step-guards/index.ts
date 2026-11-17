import { randomUUID } from 'node:crypto';
import type {
  MastraStorage,
  WorkflowStepCompletionGuard,
  WorkflowStepStartGuard,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { assert, beforeEach, describe, expect, it } from 'vitest';

type StepWrite = {
  stepId: string;
  result: StepResult<any, any, any, any>;
  requestContext: Record<string, any>;
  state?: Record<string, any>;
  startGuard?: WorkflowStepStartGuard;
  completionGuard?: WorkflowStepCompletionGuard;
};

export function createWorkflowStepGuardTests({
  storage,
  peerStorage = storage,
}: {
  storage: MastraStorage;
  peerStorage?: MastraStorage;
}) {
  describe.each([1, 2] as const)('Workflow occurrence guards (storage v%i)', storageVersion => {
    const stores = [storage, peerStorage];
    const workflowName = 'guarded-workflow';
    beforeEach(async ctx => {
      const workflows = await storage.getStore('workflows');
      if (!workflows?.supportsWorkflowStepGuards()) ctx.skip();
      if (storageVersion === 2 && !workflows?.supportsRunJournal()) ctx.skip();
    });

    // v1 writes the step into the run's snapshot; v2 appends it, with `state` as a patch.
    async function writeStep(worker: WorkflowsStorage | undefined, runId: string, { state, ...write }: StepWrite) {
      if (storageVersion === 1) {
        await worker!.updateWorkflowResults({ workflowName, runId, ...write, state });
        return;
      }
      await worker!.appendWorkflowRunEntries({
        workflowName,
        runId,
        steps: { [write.stepId]: write.result },
        requestContext: write.requestContext,
        statePatch: state && Object.entries(state).map(([key, value]) => ({ op: 'set' as const, path: [key], value })),
        startGuard: write.startGuard,
        completionGuard: write.completionGuard,
      });
    }
    // v1 keeps a run's state in the snapshot's `__state` step, v2 in `value`.
    const stateOf = (snapshot: WorkflowRunState | null | undefined) =>
      storageVersion === 1 ? snapshot?.context.__state : snapshot?.value;

    async function setup() {
      const [a, b] = await Promise.all(stores.map(store => store.getStore('workflows')));
      const runId = randomUUID();
      const snapshot: WorkflowRunState = {
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
      };
      if (storageVersion === 1) {
        await a!.persistWorkflowSnapshot({ workflowName, runId, snapshot });
      } else {
        const { context, value, ...header } = snapshot;
        await a!.writeWorkflowRunCheckpoint({ workflowName, runId, header, steps: context, state: value });
      }
      const write = (worker: typeof a, eventId: string, expectedStartedBy?: string) =>
        writeStep(worker, runId, {
          stepId: 'step',
          result: { status: 'running', startedAt: 1, payload: {}, metadata: { startedBy: eventId } },
          requestContext: {},
          startGuard: { eventId, expectedStartedBy },
        });
      const finish = (eventId: string, n: number) =>
        writeStep(a, runId, {
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
      const load = () => a!.loadWorkflowSnapshot({ workflowName, runId, storageVersion });
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
      const error = await write(b, 'first').catch(e => e);
      // The rejection carries the stored run, so the delivery continues from what was committed.
      expect(error).toMatchObject({
        code: 'WORKFLOW_STEP_CONFLICT',
        reason: 'completed',
        storedResult: { status: 'success', output: 1 },
        storedRequestContext: { n: 1 },
      });
      expect(stateOf(error.storedSnapshot)).toEqual({ n: 1 });
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
      const { a, runId, write, finish, load } = await setup();
      await write(a, 'first');
      await finish('first', 1);
      await writeStep(a, runId, {
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
      assert(predecessor?.status === 'success');
      await writeStep(a, runId, {
        stepId: 'later',
        result: { status: 'success', payload: {}, output: 2, startedAt: 1, endedAt: 2 },
        requestContext: { n: 2 },
        state: { n: 2 },
      });
      const prune = () =>
        writeStep(b, runId, {
          stepId: 'step',
          result: { ...predecessor, output: undefined },
          requestContext: { n: 999 },
          state: { n: 999 },
          completionGuard: { eventId: 'first', pruneOnly: true },
        });
      await prune();
      const pruned = await load();
      expect(pruned!.context.step).toMatchObject({ metadata: { __continuationStarted: true } });
      assert(pruned?.context.step?.status === 'success');
      expect(pruned.context.step.output).toBeUndefined();
      expect(stateOf(pruned)).toEqual({ n: 2 });
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
      await writeStep(a, runId, {
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
      const outcomes = await Promise.allSettled([
        write(a, 'successor-a', 'restart'),
        write(b, 'successor-b', 'restart'),
      ]);
      expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
      expect((await load())!.context.step?.metadata?.__restartPending).toBeUndefined();
    });

    it('prunes a predecessor only when its successor claims the full input atomically', async () => {
      const { a, b, runId, write, finish, load } = await setup();
      await write(a, 'first');
      await finish('first', 1);
      const predecessor = (await load())!.context.step;
      assert(predecessor?.status === 'success');
      const claim = (eventId: string) =>
        writeStep(b, runId, {
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
      assert(before?.context.step?.status === 'success');
      expect(before.context.step.output).toBeUndefined();
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
        writeStep(worker, randomUUID(), {
          stepId: 'step',
          requestContext: {},
          result: { status: 'running', startedAt: 1, payload: {}, metadata: { startedBy: 'first' } },
          startGuard: { eventId: 'first' },
        }),
      ).rejects.toMatchObject({ code: 'WORKFLOW_STEP_CONFLICT', reason: 'missing' });
    });

    it.each(['start', 'completion'] as const)('accepts a legacy row on a guarded %s write', async phase => {
      const { a, b, runId, write, finish, load } = await setup();
      await writeStep(a, runId, {
        stepId: 'step',
        requestContext: {},
        result: { status: 'running', startedAt: 1, payload: {} },
      });
      if (phase === 'start') await write(b, 'first');
      else await finish('first', 1);
      expect((await load())!.context.step).toMatchObject({
        status: phase === 'start' ? 'running' : 'success',
        metadata: { startedBy: 'first' },
      });
      const before = await load();
      await expect(write(b, 'competing')).rejects.toMatchObject({ reason: 'stale' });
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
}
