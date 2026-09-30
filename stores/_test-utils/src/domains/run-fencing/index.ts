import type { MastraStorage, MemoryStorage, RunFence, WorkflowsStorage } from '@mastra/core/storage';
import { isRunFenceConflictError } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSampleMessageV2, createSampleThread } from '../memory/data';

export interface RunFencingTestOptions {
  storage: MastraStorage;
}

const LEASE_MS = 30_000;
const SHORT_LEASE_MS = 200;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));

const snapshotWithValue = (runId: string, value: string) =>
  ({
    runId,
    status: 'running',
    value: { writer: value },
    context: {},
    serializedStepGraph: [],
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    waitingPaths: {},
    timestamp: Date.now(),
  }) as unknown as WorkflowRunState;

async function expectFenceConflict(write: Promise<unknown>) {
  const error = await write.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error, 'expected the fenced write to be rejected').toBeDefined();
  expect(isRunFenceConflictError(error)).toBe(true);
}

/**
 * Conformance cases for run ownership and fenced writes. Adapters opt in per
 * domain through `supportsRunFencing()`; cases for a domain that doesn't
 * declare it are skipped.
 */
export function createRunFencingTests({ storage }: RunFencingTestOptions) {
  describe('Run fencing: workflows', () => {
    let workflows: WorkflowsStorage;

    beforeAll(async () => {
      const store = await storage.getStore('workflows');
      if (!store) throw new Error('Workflows storage not found');
      workflows = store;
    });

    const claim = (runId: string, ownerId: string, extra: { force?: boolean; expectedGeneration?: number } = {}) =>
      workflows.claimRunOwnership({ runId, ownerId, leaseMs: LEASE_MS, ...extra });

    const claimed = async (runId: string, ownerId: string, force = false): Promise<RunFence> => {
      const result = await claim(runId, ownerId, { force });
      expect(result.acquired).toBe(true);
      return { runId, ownerId, generation: result.record!.generation };
    };

    describe('ownership', () => {
      it('claims an unowned run at generation 1', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        expect(await workflows.getRunOwnership({ runId })).toBeNull();

        const before = Date.now();
        const result = await claim(runId, 'owner-a');

        expect(result.acquired).toBe(true);
        expect(result.record).toMatchObject({ runId, generation: 1, ownerId: 'owner-a', live: true });
        // The store's clock may differ from ours; allow generous skew.
        const expiresAt = result.record!.leaseExpiresAt!.getTime();
        expect(expiresAt).toBeGreaterThan(before + LEASE_MS - 60_000);
        expect(expiresAt).toBeLessThan(before + LEASE_MS + 60_000);

        expect(await workflows.getRunOwnership({ runId })).toMatchObject({
          runId,
          generation: 1,
          ownerId: 'owner-a',
          live: true,
        });
      });

      it('refuses to claim a live run without force, and takes it over with force', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        await claimed(runId, 'owner-a');

        const refused = await claim(runId, 'owner-b');
        expect(refused.acquired).toBe(false);
        expect(refused.record).toMatchObject({ generation: 1, ownerId: 'owner-a', live: true });

        const forced = await claim(runId, 'owner-b', { force: true });
        expect(forced.acquired).toBe(true);
        expect(forced.record).toMatchObject({ generation: 2, ownerId: 'owner-b', live: true });
      });

      it('claims a run whose lease expired without force', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const first = await workflows.claimRunOwnership({ runId, ownerId: 'owner-a', leaseMs: SHORT_LEASE_MS });
        expect(first.acquired).toBe(true);

        await sleep(SHORT_LEASE_MS * 3);
        expect(await workflows.getRunOwnership({ runId })).toMatchObject({ ownerId: 'owner-a', live: false });

        const second = await claim(runId, 'owner-b');
        expect(second.acquired).toBe(true);
        expect(second.record).toMatchObject({ generation: 2, ownerId: 'owner-b' });
      });

      it('lets exactly one of several concurrent claims win', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const results = await Promise.all(
          Array.from({ length: 8 }, (_, i) => claim(runId, `owner-${i}`).catch(error => ({ error }))),
        );

        const winners = results.filter(r => 'acquired' in r && r.acquired);
        expect(winners).toHaveLength(1);
        const owner = await workflows.getRunOwnership({ runId });
        expect(owner).toMatchObject({ generation: 1, live: true });
        expect(owner!.ownerId).toBe((winners[0] as { record: { ownerId: string } }).record.ownerId);
      });

      it('lets exactly one of several concurrent forced claims that saw the same generation win', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        await claimed(runId, 'owner-a');

        const results = await Promise.all(
          Array.from({ length: 8 }, (_, i) =>
            claim(runId, `taker-${i}`, { force: true, expectedGeneration: 1 }).catch(error => ({ error })),
          ),
        );

        expect(results.filter(r => 'acquired' in r && r.acquired)).toHaveLength(1);
        expect(await workflows.getRunOwnership({ runId })).toMatchObject({ generation: 2 });
      });

      it('refuses a claim whose expected generation is stale', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        await claimed(runId, 'owner-a');

        const result = await claim(runId, 'owner-b', { force: true, expectedGeneration: 0 });
        expect(result.acquired).toBe(false);
        expect(result.record).toMatchObject({ generation: 1, ownerId: 'owner-a' });
      });

      it('renews only while the claim is current, even after the lease expired', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const first = await workflows.claimRunOwnership({ runId, ownerId: 'owner-a', leaseMs: SHORT_LEASE_MS });
        const fenceA: RunFence = { runId, ownerId: 'owner-a', generation: first.record!.generation };

        await sleep(SHORT_LEASE_MS * 3);
        const renewed = await workflows.renewRunOwnership({ ...fenceA, leaseMs: LEASE_MS });
        expect(renewed.renewed).toBe(true);
        expect(renewed.record).toMatchObject({ generation: 1, ownerId: 'owner-a', live: true });

        await claimed(runId, 'owner-b', true);
        const afterTakeover = await workflows.renewRunOwnership({ ...fenceA, leaseMs: LEASE_MS });
        expect(afterTakeover.renewed).toBe(false);
        expect(afterTakeover.record).toMatchObject({ generation: 2, ownerId: 'owner-b' });
      });

      it('release keeps the generation, and remove deletes the record', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');

        expect(await workflows.releaseRunOwnership({ ...fenceA, generation: 99 })).toBe(false);
        expect(await workflows.releaseRunOwnership(fenceA)).toBe(true);
        expect(await workflows.getRunOwnership({ runId })).toMatchObject({
          generation: 1,
          ownerId: null,
          leaseExpiresAt: null,
          live: false,
        });
        expect(await workflows.releaseRunOwnership(fenceA)).toBe(false);

        const fenceB = await claimed(runId, 'owner-b');
        expect(fenceB.generation).toBe(2);
        expect(await workflows.releaseRunOwnership({ ...fenceB, remove: true })).toBe(true);
        expect(await workflows.getRunOwnership({ runId })).toBeNull();
      });
    });

    describe('fenced writes', () => {
      const workflowName = 'run-fencing-workflow';

      it('accepts writes from the current claim and rejects writes from a superseded one', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');

        await workflows.persistWorkflowSnapshot({
          workflowName,
          runId,
          snapshot: snapshotWithValue(runId, 'a'),
          fence: fenceA,
        });
        await workflows.updateWorkflowResults({
          workflowName,
          runId,
          stepId: 'step-a',
          result: { status: 'success', output: 'a', payload: {}, startedAt: 1, endedAt: 2 } as any,
          requestContext: {},
          fence: fenceA,
        });
        await workflows.updateWorkflowState({ workflowName, runId, opts: { status: 'running' }, fence: fenceA });

        const fenceB = await claimed(runId, 'owner-b', true);

        await expectFenceConflict(
          workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot: snapshotWithValue(runId, 'stale'),
            fence: fenceA,
          }),
        );
        await expectFenceConflict(
          workflows.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'step-stale',
            result: { status: 'success', output: 'stale', payload: {}, startedAt: 1, endedAt: 2 } as any,
            requestContext: {},
            fence: fenceA,
          }),
        );
        await expectFenceConflict(
          workflows.updateWorkflowState({ workflowName, runId, opts: { status: 'failed' }, fence: fenceA }),
        );
        await expectFenceConflict(workflows.deleteWorkflowRunById({ workflowName, runId, fence: fenceA }));

        const snapshot = await workflows.loadWorkflowSnapshot({ workflowName, runId });
        expect(snapshot?.value).toEqual({ writer: 'a' });
        expect(snapshot?.status).toBe('running');
        expect(snapshot?.context).not.toHaveProperty('step-stale');

        await workflows.persistWorkflowSnapshot({
          workflowName,
          runId,
          snapshot: snapshotWithValue(runId, 'b'),
          fence: fenceB,
        });
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({ writer: 'b' });

        await workflows.deleteWorkflowRunById({ workflowName, runId, fence: fenceB });
        expect(await workflows.loadWorkflowSnapshot({ workflowName, runId })).toBeNull();
      });

      it('rejects writes after the claim was released', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');
        await workflows.persistWorkflowSnapshot({
          workflowName,
          runId,
          snapshot: snapshotWithValue(runId, 'a'),
          fence: fenceA,
        });
        await workflows.releaseRunOwnership(fenceA);

        await expectFenceConflict(
          workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot: snapshotWithValue(runId, 'late'),
            fence: fenceA,
          }),
        );
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({ writer: 'a' });
      });

      it('leaves writes without a fence unchanged', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        await claimed(runId, 'owner-a');

        await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshotWithValue(runId, 'plain') });
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({ writer: 'plain' });
      });

      it('never lets a superseded writer overwrite the new owner, even while racing the takeover', async ctx => {
        if (!workflows.supportsRunFencing()) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');

        let stop = false;
        let staleAttempts = 0;
        const staleWriter = (async () => {
          while (!stop) {
            try {
              await workflows.persistWorkflowSnapshot({
                workflowName,
                runId,
                snapshot: snapshotWithValue(runId, `a-${staleAttempts++}`),
                fence: fenceA,
              });
            } catch (error) {
              if (!isRunFenceConflictError(error)) throw error;
            }
            await yieldToEventLoop();
          }
        })();

        await sleep(5);
        const fenceB = await claimed(runId, 'owner-b', true);
        await workflows.persistWorkflowSnapshot({
          workflowName,
          runId,
          snapshot: snapshotWithValue(runId, 'b'),
          fence: fenceB,
        });
        // Keep the stale writer going past B's write before stopping it.
        const attemptsAtTakeover = staleAttempts;
        await sleep(20);
        stop = true;
        await staleWriter;

        expect(staleAttempts).toBeGreaterThan(attemptsAtTakeover);
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({ writer: 'b' });
      });
    });
  });

  describe('Run fencing: memory', () => {
    let memory: MemoryStorage;

    beforeAll(async () => {
      const store = await storage.getStore('memory');
      if (!store) throw new Error('Memory storage not found');
      memory = store;
    });

    const fence = (runId: string, generation: number, ownerId = `owner-${generation}`): RunFence => ({
      runId,
      generation,
      ownerId,
    });

    it('raises monotonically', async ctx => {
      if (!memory.supportsRunFencing()) return ctx.skip();
      const runId = `run-${randomUUID()}`;

      expect(await memory.raiseRunFence(fence(runId, 2))).toBe(true);
      expect(await memory.raiseRunFence(fence(runId, 2))).toBe(true);
      expect(await memory.raiseRunFence(fence(runId, 2, 'someone-else'))).toBe(false);
      expect(await memory.raiseRunFence(fence(runId, 1))).toBe(false);
      expect(await memory.raiseRunFence(fence(runId, 3))).toBe(true);
    });

    it('accepts writes from the current fence and rejects writes from an older one', async ctx => {
      if (!memory.supportsRunFencing()) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);
      await memory.raiseRunFence(fenceA);

      const thread = createSampleThread();
      await memory.saveThread({ thread, fence: fenceA });
      const message = createSampleMessageV2({
        threadId: thread.id,
        resourceId: thread.resourceId,
        content: { content: 'a' },
      });
      await memory.saveMessages({ messages: [message], fence: fenceA });
      await memory.updateThread({ id: thread.id, title: 'title-a', fence: fenceA });
      await memory.updateResource({ resourceId: thread.resourceId, workingMemory: 'wm-a', fence: fenceA });

      const fenceB = fence(runId, 2);
      expect(await memory.raiseRunFence(fenceB)).toBe(true);

      await expectFenceConflict(memory.saveThread({ thread: { ...thread, title: 'stale' }, fence: fenceA }));
      await expectFenceConflict(memory.updateThread({ id: thread.id, title: 'stale', fence: fenceA }));
      await expectFenceConflict(memory.patchThread({ id: thread.id, metadata: { stale: true }, fence: fenceA }));
      await expectFenceConflict(
        memory.saveMessages({
          messages: [createSampleMessageV2({ threadId: thread.id, resourceId: thread.resourceId })],
          fence: fenceA,
        }),
      );
      await expectFenceConflict(
        memory.saveMessages({
          messages: [{ ...message, content: { ...message.content, content: 'stale' } }],
          fence: fenceA,
        }),
      );
      await expectFenceConflict(
        memory.updateMessages({
          messages: [{ id: message.id, content: { content: 'stale' } as any }],
          fence: fenceA,
        }),
      );
      await expectFenceConflict(memory.deleteMessages([message.id], { fence: fenceA }));
      await expectFenceConflict(
        memory.updateResource({ resourceId: thread.resourceId, workingMemory: 'stale', fence: fenceA }),
      );

      const storedThread = await memory.getThreadById({ threadId: thread.id });
      expect(storedThread?.title).toBe('title-a');
      expect(storedThread?.metadata).not.toHaveProperty('stale');
      const { messages } = await memory.listMessages({ threadId: thread.id });
      expect(messages).toHaveLength(1);
      expect(messages[0]!.content.content).toBe('a');
      expect((await memory.getResourceById({ resourceId: thread.resourceId }))?.workingMemory).toBe('wm-a');

      await memory.updateMessages({ messages: [{ id: message.id, content: { content: 'b' } as any }], fence: fenceB });
      await memory.deleteMessages([message.id], { fence: fenceB });
      expect((await memory.listMessages({ threadId: thread.id })).messages).toHaveLength(0);
    });

    it('rejects writes after the fence was released', async ctx => {
      if (!memory.supportsRunFencing()) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);
      await memory.raiseRunFence(fenceA);
      const thread = createSampleThread();
      await memory.saveThread({ thread, fence: fenceA });

      expect(await memory.releaseRunFence({ ...fenceA, ownerId: 'someone-else' })).toBe(false);
      expect(await memory.releaseRunFence(fenceA)).toBe(true);
      await expectFenceConflict(memory.updateThread({ id: thread.id, title: 'late', fence: fenceA }));
      expect(await memory.raiseRunFence(fenceA)).toBe(false);

      const fenceB = fence(runId, 2);
      expect(await memory.raiseRunFence(fenceB)).toBe(true);
      await memory.updateThread({ id: thread.id, title: 'b', fence: fenceB });
      expect(await memory.releaseRunFence({ ...fenceB, remove: true })).toBe(true);
      await expectFenceConflict(memory.updateThread({ id: thread.id, title: 'late', fence: fenceB }));
      expect((await memory.getThreadById({ threadId: thread.id }))?.title).toBe('b');
    });

    it('leaves writes without a fence unchanged', async ctx => {
      if (!memory.supportsRunFencing()) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      await memory.raiseRunFence(fence(runId, 1));
      const thread = createSampleThread();
      await memory.saveThread({ thread });
      await memory.saveMessages({
        messages: [createSampleMessageV2({ threadId: thread.id, resourceId: thread.resourceId })],
      });
      expect((await memory.listMessages({ threadId: thread.id })).messages).toHaveLength(1);
    });

    it('never lets a superseded writer overwrite the new owner, even while racing the takeover', async ctx => {
      if (!memory.supportsRunFencing()) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);
      await memory.raiseRunFence(fenceA);
      const thread = createSampleThread();
      await memory.saveThread({ thread, fence: fenceA });
      const message = createSampleMessageV2({ threadId: thread.id, resourceId: thread.resourceId, role: 'assistant' });
      const withText = (text: string) => ({ ...message, content: { ...message.content, content: text } });

      let stop = false;
      let staleAttempts = 0;
      const staleWriter = (async () => {
        while (!stop) {
          try {
            await memory.saveMessages({ messages: [withText(`a-${staleAttempts++}`)], fence: fenceA });
          } catch (error) {
            if (!isRunFenceConflictError(error)) throw error;
          }
          await yieldToEventLoop();
        }
      })();

      await sleep(5);
      const fenceB = fence(runId, 2);
      expect(await memory.raiseRunFence(fenceB)).toBe(true);
      await memory.saveMessages({ messages: [withText('b')], fence: fenceB });
      const attemptsAtTakeover = staleAttempts;
      await sleep(20);
      stop = true;
      await staleWriter;

      expect(staleAttempts).toBeGreaterThan(attemptsAtTakeover);
      const { messages } = await memory.listMessages({ threadId: thread.id });
      expect(messages).toHaveLength(1);
      expect(messages[0]!.content.content).toBe('b');
    });
  });
}
