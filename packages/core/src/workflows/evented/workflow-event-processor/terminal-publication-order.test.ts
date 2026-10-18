import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { WorkflowEventProcessor } from './index';
import type { ProcessorArgs } from './index';

class TerminalProcessor extends WorkflowEventProcessor {
  end(args: ProcessorArgs, status?: 'success' | 'canceled' | 'paused') {
    return this.endWorkflow(args, status);
  }

  fail(args: ProcessorArgs) {
    return this.processWorkflowFail(args);
  }
}

function failedResult(message = 'step failed'): ProcessorArgs['prevResult'] {
  return { status: 'failed', payload: {}, startedAt: 1, endedAt: 2, error: new Error(message) };
}

const instances: Mastra[] = [];
afterEach(async () => {
  await Promise.all(instances.splice(0).map(mastra => mastra.shutdown()));
  vi.restoreAllMocks();
});

async function setup({
  nested = false,
  loop = false,
  persist = false,
  ownershipLost = false,
  defaultPolicy = false,
} = {}) {
  const storage = new MockStore();
  const store = (await storage.getStore('workflows'))!;
  const pubsub = new EventEmitterPubSub();
  const policy = vi.fn(() => persist);
  const workflow = createWorkflow({
    id: 'child',
    inputSchema: z.any(),
    outputSchema: z.any(),
    options: {
      ...(!defaultPolicy && { shouldPersistSnapshot: policy }),
      isOwnershipLostError: error => ownershipLost && error instanceof Error && error.message === 'ownership lost',
    },
  }).commit();
  const parent = createWorkflow({ id: 'parent', inputSchema: z.any(), outputSchema: z.any() });
  if (loop) {
    parent.dowhile(
      createStep({ id: 'body', inputSchema: z.any(), outputSchema: z.any(), execute: async () => ({}) }),
      async () => true,
    );
  }
  parent.commit();
  const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { parent } });
  instances.push(mastra);
  mastra.__registerInternalWorkflow(workflow, 'child-run');
  const processor = new TerminalProcessor({ mastra });
  const args: ProcessorArgs = {
    workflow,
    workflowId: 'child',
    runId: 'child-run',
    executionPath: [],
    resumeSteps: [],
    stepResults: {},
    activeStepsPath: {},
    requestContext: {},
    prevResult: { status: 'success', output: {}, payload: {}, startedAt: Date.now(), endedAt: Date.now() },
    ...(nested || loop
      ? {
          parentWorkflow: {
            workflowId: 'parent',
            runId: 'parent-run',
            executionPath: [0],
            resume: false,
            stepResults: {},
            stepId: 'child',
            stepGraph: parent.stepGraph,
            activeStepsPath: {},
            resumeSteps: [],
            resumeData: undefined,
            input: {},
          },
        }
      : {}),
  };
  await store.persistWorkflowSnapshot({
    workflowName: args.workflowId,
    runId: args.runId,
    snapshot: {
      runId: args.runId,
      status: 'running',
      value: {},
      context: {},
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      serializedStepGraph: [],
      waitingPaths: {},
      timestamp: Date.now(),
    },
  });
  const row = () => store.getWorkflowRunById({ runId: args.runId, workflowName: args.workflowId });
  const original = await row();
  const events: { topic: string; event: Event }[] = [];
  let reject: ((topic: string, event: Event) => boolean) | undefined;
  const publish = vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event) => {
    const serialized: Event = JSON.parse(
      JSON.stringify({ ...event, id: `event-${events.length}`, createdAt: new Date() }),
    );
    if (reject?.(topic, serialized)) throw new Error('LOADING terminal publication');
    events.push({ topic, event: serialized });
  });
  const deleted = vi.spyOn(store, 'deleteWorkflowRunById');
  const endEvent = () => {
    const message = events.find(({ topic, event }) => topic === 'workflows' && event.type === 'workflow.end');
    if (!message) throw new Error('Missing workflow.end handoff');
    return message.event;
  };
  return {
    args,
    mastra,
    processor,
    store,
    row,
    original,
    events,
    publish,
    deleted,
    policy,
    endEvent,
    rejectWhen: (predicate?: typeof reject) => {
      reject = predicate;
    },
    consume: (event = endEvent()) => new TerminalProcessor({ mastra }).handle(event),
  };
}

describe('evented terminal publication ordering', () => {
  for (const nested of [false, true]) {
    describe(nested ? 'nested run' : 'top-level run', () => {
      for (const boundary of ['watch', 'workflow.end']) {
        it(`retains the running snapshot when producer ${boundary} publication fails`, async () => {
          const f = await setup({ nested });
          f.rejectWhen((_topic, event) => event.type === boundary);
          await expect(f.processor.end(f.args)).rejects.toThrow('LOADING');
          expect(await f.row()).toEqual(f.original);
          expect(f.deleted).not.toHaveBeenCalled();
          f.rejectWhen();
          await f.processor.end(f.args);
          expect(await f.consume()).toEqual({ ok: true });
          expect(await f.row()).toBeNull();
        });
      }

      for (const boundary of nested ? ['parent', 'finish'] : ['finish']) {
        it(`retains the serialized success handoff on ${boundary} failure and deletes after retry`, async () => {
          const f = await setup({ nested });
          await f.processor.end(f.args);
          expect(await f.row()).toEqual(f.original);
          f.rejectWhen((topic, event) =>
            boundary === 'parent' ? event.type === 'workflow.step.end' : topic === 'workflows-finish',
          );
          const consumer = new TerminalProcessor({ mastra: f.mastra });
          const event = f.endEvent();
          expect(await consumer.handle(event)).toEqual({ ok: false, retry: true });
          expect(await f.row()).toEqual(f.original);
          expect(f.deleted).not.toHaveBeenCalled();
          expect(f.mastra.__hasInternalWorkflow('child', 'child-run')).toBe(true);
          f.rejectWhen();
          await expect(consumer.handle(event)).resolves.toEqual({ ok: true });
          expect(await f.row()).toBeNull();
          expect(f.policy).toHaveBeenCalledTimes(1);
          expect(f.mastra.__hasInternalWorkflow('child', 'child-run')).toBe(false);
          for (const { topic, event: published } of f.events) {
            if (topic === 'workflows-finish' || published.type === 'workflow.step.end') {
              expect(published.data).not.toHaveProperty('deleteSnapshotAfterEnd');
            }
            if (published.type === 'workflow.step.end') expect(published.runId).toBe('parent-run');
          }
        });

        it(`retains the running snapshot when failure ${boundary} publication fails`, async () => {
          const f = await setup({ nested });
          f.args.prevResult = failedResult();
          f.rejectWhen((topic, event) =>
            boundary === 'parent' ? event.type === 'workflow.step.end' : topic === 'workflows-finish',
          );
          await expect(f.processor.fail(f.args)).rejects.toThrow('LOADING');
          expect(await f.row()).toEqual(f.original);
          expect(f.deleted).not.toHaveBeenCalled();
          expect(f.mastra.__hasInternalWorkflow('child', 'child-run')).toBe(true);
          f.rejectWhen();
          await f.processor.fail(f.args);
          expect(await f.row()).toBeNull();
          expect(f.mastra.__hasInternalWorkflow('child', 'child-run')).toBe(false);
        });
      }
      it('retries a serialized workflow.fail without losing its snapshot', async () => {
        const f = await setup({ nested });
        const event: Event = JSON.parse(
          JSON.stringify({
            id: 'failure-event',
            createdAt: new Date(),
            type: 'workflow.fail',
            runId: f.args.runId,
            data: {
              ...f.args,
              workflow: undefined,
              prevResult: { ...f.args.prevResult, status: 'failed', error: { message: 'step failed' } },
            },
          }),
        );
        f.rejectWhen(topic => topic === 'workflows-finish');
        const consumer = new TerminalProcessor({ mastra: f.mastra });
        expect(await consumer.handle(event)).toEqual({ ok: false, retry: true });
        expect(await f.row()).toEqual(f.original);
        expect(f.deleted).not.toHaveBeenCalled();
        f.rejectWhen();
        expect(await consumer.handle(event)).toEqual({ ok: true });
        expect(await f.row()).toBeNull();
      });
    });
  }

  for (const failure of [false, true]) {
    it(`waits for the pending ${failure ? 'failure' : 'success'} finish publication before deleting`, async () => {
      const f = await setup({ nested: true });
      let enter!: () => void;
      let release!: () => void;
      const entered = new Promise<void>(resolve => {
        enter = resolve;
      });
      const finish = new Promise<void>(resolve => {
        release = resolve;
      });
      if (failure) f.args.prevResult = failedResult();
      f.publish.mockImplementation(async topic => {
        if (topic === 'workflows-finish') {
          enter();
          await finish;
        }
      });
      const completion = failure
        ? f.processor.fail(f.args)
        : new TerminalProcessor({ mastra: f.mastra }).handle({
            id: 'pending-end-event',
            createdAt: new Date(),
            type: 'workflow.end',
            runId: f.args.runId,
            data: { ...f.args, workflow: undefined, deleteSnapshotAfterEnd: true },
          });
      await entered;
      try {
        expect(await f.row()).toEqual(f.original);
        expect(f.deleted).not.toHaveBeenCalled();
      } finally {
        release();
        await completion;
      }
      expect(await f.row()).toBeNull();
    });

    it(`keeps opted-in ${failure ? 'failed' : 'successful'} snapshots`, async () => {
      const f = await setup({ persist: true });
      if (failure) {
        f.args.prevResult = failedResult();
        await f.processor.fail(f.args);
      } else {
        await f.processor.end(f.args);
        expect(await f.consume()).toEqual({ ok: true });
      }
      expect((await f.row())?.snapshot).toMatchObject({ status: failure ? 'failed' : 'success' });
      expect(f.deleted).not.toHaveBeenCalled();
    });

    it(`warns without failing completion when ${failure ? 'failure' : 'success'} cleanup rejects`, async () => {
      const f = await setup();
      const warn = vi.spyOn(f.mastra.getLogger(), 'warn');
      f.deleted.mockRejectedValue(new Error('storage unavailable'));
      if (failure) {
        await expect(f.processor.fail(f.args)).resolves.toBeUndefined();
      } else {
        await f.processor.end(f.args);
        expect(await f.consume()).toEqual({ ok: true });
      }
      expect(await f.row()).toEqual(f.original);
      expect(warn).toHaveBeenCalledWith('Failed to clean up workflow snapshot', expect.any(Object));
    });
  }

  for (const mode of ['per-step', 'paused'] as const) {
    it(`does not delete a declined ${mode} snapshot`, async () => {
      const f = await setup();
      f.args.perStep = mode === 'per-step';
      await f.processor.end(f.args, mode === 'paused' ? 'paused' : 'success');
      expect(f.endEvent().data.deleteSnapshotAfterEnd).toBe(false);
      expect(await f.consume()).toEqual({ ok: true });
      expect(await f.row()).toEqual(f.original);
      expect(f.deleted).not.toHaveBeenCalled();
    });
  }

  it('deletes a declined canceled snapshot only after the end handoff completes', async () => {
    const f = await setup();
    f.args.prevResult = { ...f.args.prevResult, status: 'canceled' };
    await f.processor.end(f.args, 'canceled');
    expect(f.endEvent().data.prevResult.status).toBe('canceled');
    expect(await f.row()).toEqual(f.original);
    expect(await f.consume()).toEqual({ ok: true });
    expect(await f.row()).toBeNull();
  });

  it('preserves a snapshot owned by another execution despite declined terminal persistence', async () => {
    const f = await setup({ ownershipLost: true });
    f.args.prevResult = failedResult('ownership lost');
    const updated = vi.spyOn(f.store, 'updateWorkflowState');
    await f.processor.fail(f.args);
    expect(await f.row()).toEqual(f.original);
    expect(f.deleted).not.toHaveBeenCalled();
    expect(updated).not.toHaveBeenCalled();
    expect(f.events.some(({ topic }) => topic === 'workflows-finish')).toBe(true);
  });

  it('overrides inherited cleanup intent when the workflow uses default persistence', async () => {
    const f = await setup({ defaultPolicy: true });
    const inherited = { ...f.args, deleteSnapshotAfterEnd: true };
    await f.processor.end(inherited);
    expect(f.endEvent().data.deleteSnapshotAfterEnd).toBe(false);
    expect(await f.consume()).toEqual({ ok: true });
    expect((await f.row())?.snapshot).toMatchObject({ status: 'success' });
    expect(f.deleted).not.toHaveBeenCalled();
  });

  for (const intent of [true, undefined]) {
    it(`consumes cleanup intent ${intent} on a worker without the workflow definition`, async () => {
      const f = await setup();
      await f.processor.end(f.args);
      const event = f.endEvent();
      if (intent === undefined) delete event.data.deleteSnapshotAfterEnd;
      const consumerMastra = new Mastra({ logger: false, storage: f.mastra.getStorage(), pubsub: f.mastra.pubsub });
      instances.push(consumerMastra);
      expect(consumerMastra.__hasInternalWorkflow('child', 'child-run')).toBe(false);
      expect(await new TerminalProcessor({ mastra: consumerMastra }).handle(event)).toEqual({ ok: true });
      expect(await f.row()).toEqual(intent ? null : f.original);
    });
  }

  for (const intent of [undefined, false, 'true']) {
    it(`does not authorize deletion for legacy or non-boolean cleanup intent ${intent}`, async () => {
      const f = await setup();
      await f.processor.end(f.args);
      const event = f.endEvent();
      if (intent === undefined) delete event.data.deleteSnapshotAfterEnd;
      else event.data.deleteSnapshotAfterEnd = intent;
      expect(await f.consume(event)).toEqual({ ok: true });
      expect(await f.row()).toEqual(f.original);
      expect(f.deleted).not.toHaveBeenCalled();
    });
  }

  for (const boundary of ['continuation', 'finish']) {
    it(`retains the snapshot if nested loop ${boundary} publication fails`, async () => {
      const f = await setup({ loop: true });
      await f.processor.end(f.args);
      f.rejectWhen((topic, event) =>
        boundary === 'continuation' ? event.type === 'workflow.step.run' : topic === 'workflows-finish',
      );
      expect(await f.consume()).toEqual({ ok: false, retry: true });
      expect(await f.row()).toEqual(f.original);
      expect(f.deleted).not.toHaveBeenCalled();
      f.rejectWhen();
      expect(await f.consume()).toEqual({ ok: true });
      expect(await f.row()).toBeNull();
      for (const { topic, event } of f.events) {
        if (topic === 'workflows-finish' || event.type === 'workflow.step.run') {
          expect(event.data).not.toHaveProperty('deleteSnapshotAfterEnd');
        }
        if (event.type === 'workflow.step.run') expect(event.runId).toBe('parent-run');
      }
    });
  }
});
