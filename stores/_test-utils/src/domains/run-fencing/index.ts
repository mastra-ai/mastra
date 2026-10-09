import type {
  MastraStorage,
  MemoryStorage,
  RunFence,
  RunFenceContext,
  RunFenceScope,
  WorkflowsStorage,
} from '@mastra/core/storage';
import { isRunFenceConflictError, setRunFenceContext } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { AsyncLocalStorage } from 'node:async_hooks';
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

/**
 * Waits until a looping writer has started another attempt. A fixed sleep is
 * not enough on stores where a single write can outlast it.
 */
const waitForAttemptAfter = async (attempts: () => number, seen: number) => {
  const deadline = Date.now() + 10_000;
  while (attempts() <= seen && Date.now() < deadline) await sleep(5);
};

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

// Stands in for the durable runtime's scope. If core already installed its
// context, scopes run through that one, as they do in production.
const testScopes = new AsyncLocalStorage<RunFenceScope | undefined>();
let runFenceContext: RunFenceContext | undefined;
function inRunFenceScope<T>(scope: RunFenceScope, fn: () => T): T {
  runFenceContext ??= setRunFenceContext({
    current: () => testScopes.getStore(),
    run: (s, f) => testScopes.run(s, f),
  });
  return runFenceContext.run(scope, fn);
}

/** A scope that records the lookups adapters make and the conflicts they report. */
function recordingScope(fenceFor: (store: object, runId?: string) => RunFence | undefined) {
  const lookups: { store: object; runId?: string }[] = [];
  const conflicts: RunFence[] = [];
  return {
    lookups,
    conflicts,
    fenceFor(store: object, runId?: string) {
      lookups.push(runId === undefined ? { store } : { store, runId });
      return fenceFor(store, runId);
    },
    onConflict(fence: RunFence) {
      conflicts.push(fence);
    },
  };
}

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
      it("claims an unowned run at a generation seeded from the store's clock", async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        expect(await workflows.getRunOwnership({ runId })).toBeNull();

        const before = Date.now();
        const result = await claim(runId, 'owner-a');

        expect(result.acquired).toBe(true);
        expect(result.record).toMatchObject({ runId, ownerId: 'owner-a', live: true });
        // The store's clock may differ from ours; allow generous skew.
        const { generation } = result.record!;
        expect(Number.isSafeInteger(generation)).toBe(true);
        expect(generation).toBeGreaterThan(before - 60_000);
        expect(generation).toBeLessThan(before + 60_000);
        const expiresAt = result.record!.leaseExpiresAt!.getTime();
        expect(expiresAt).toBeGreaterThan(before + LEASE_MS - 60_000);
        expect(expiresAt).toBeLessThan(before + LEASE_MS + 60_000);

        expect(await workflows.getRunOwnership({ runId })).toMatchObject({
          runId,
          generation,
          ownerId: 'owner-a',
          live: true,
        });
      });

      it('refuses to claim a live run without force, and takes it over with force', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');

        const refused = await claim(runId, 'owner-b');
        expect(refused.acquired).toBe(false);
        expect(refused.record).toMatchObject({ generation: fenceA.generation, ownerId: 'owner-a', live: true });

        const forced = await claim(runId, 'owner-b', { force: true });
        expect(forced.acquired).toBe(true);
        expect(forced.record).toMatchObject({ generation: fenceA.generation + 1, ownerId: 'owner-b', live: true });
      });

      it('claims a run whose lease expired without force', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const first = await workflows.claimRunOwnership({ runId, ownerId: 'owner-a', leaseMs: SHORT_LEASE_MS });
        expect(first.acquired).toBe(true);

        await sleep(SHORT_LEASE_MS * 3);
        expect(await workflows.getRunOwnership({ runId })).toMatchObject({ ownerId: 'owner-a', live: false });

        const second = await claim(runId, 'owner-b');
        expect(second.acquired).toBe(true);
        expect(second.record).toMatchObject({ generation: first.record!.generation + 1, ownerId: 'owner-b' });
      });

      it('lets exactly one of several concurrent claims win', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const results = await Promise.all(
          Array.from({ length: 8 }, (_, i) => claim(runId, `owner-${i}`).catch(error => ({ error }))),
        );

        const winners = results.filter(r => 'acquired' in r && r.acquired);
        expect(winners).toHaveLength(1);
        const winner = (winners[0] as { record: { generation: number; ownerId: string } }).record;
        const owner = await workflows.getRunOwnership({ runId });
        expect(owner).toMatchObject({ generation: winner.generation, ownerId: winner.ownerId, live: true });
      });

      it('lets exactly one of several concurrent forced claims that saw the same generation win', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');

        const results = await Promise.all(
          Array.from({ length: 8 }, (_, i) =>
            claim(runId, `taker-${i}`, { force: true, expectedGeneration: fenceA.generation }).catch(error => ({
              error,
            })),
          ),
        );

        expect(results.filter(r => 'acquired' in r && r.acquired)).toHaveLength(1);
        expect(await workflows.getRunOwnership({ runId })).toMatchObject({ generation: fenceA.generation + 1 });
      });

      it('refuses a claim whose expected generation is stale', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');

        const result = await claim(runId, 'owner-b', { force: true, expectedGeneration: 0 });
        expect(result.acquired).toBe(false);
        expect(result.record).toMatchObject({ generation: fenceA.generation, ownerId: 'owner-a' });
      });

      it('renews only while the claim is current, even after the lease expired', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const first = await workflows.claimRunOwnership({ runId, ownerId: 'owner-a', leaseMs: SHORT_LEASE_MS });
        const fenceA: RunFence = { runId, ownerId: 'owner-a', generation: first.record!.generation };

        await sleep(SHORT_LEASE_MS * 3);
        const renewed = await workflows.renewRunOwnership({ ...fenceA, leaseMs: LEASE_MS });
        expect(renewed.renewed).toBe(true);
        expect(renewed.record).toMatchObject({ generation: fenceA.generation, ownerId: 'owner-a', live: true });

        await claimed(runId, 'owner-b', true);
        const afterTakeover = await workflows.renewRunOwnership({ ...fenceA, leaseMs: LEASE_MS });
        expect(afterTakeover.renewed).toBe(false);
        expect(afterTakeover.record).toMatchObject({ generation: fenceA.generation + 1, ownerId: 'owner-b' });
      });

      it('release clears the lease and keeps the generation and owner', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');

        expect(await workflows.releaseRunOwnership({ ...fenceA, generation: fenceA.generation + 1 })).toBe(false);
        expect(await workflows.releaseRunOwnership({ ...fenceA, ownerId: 'someone-else' })).toBe(false);
        expect(await workflows.releaseRunOwnership(fenceA)).toBe(true);
        expect(await workflows.getRunOwnership({ runId })).toMatchObject({
          generation: fenceA.generation,
          ownerId: 'owner-a',
          leaseExpiresAt: null,
          live: false,
        });
        expect(await workflows.releaseRunOwnership(fenceA)).toBe(true);
        expect((await workflows.renewRunOwnership({ ...fenceA, leaseMs: LEASE_MS })).renewed).toBe(false);

        const fenceB = await claimed(runId, 'owner-b');
        expect(fenceB.generation).toBe(fenceA.generation + 1);
        expect(await workflows.releaseRunOwnership(fenceA)).toBe(false);
      });
    });

    describe('fenced writes', () => {
      const workflowName = 'run-fencing-workflow';

      // updateWorkflowResults and updateWorkflowState only exist on adapters
      // that support concurrent updates; the others don't implement them.

      it('accepts writes from the current claim and rejects writes from a superseded one', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const concurrent = workflows.supportsConcurrentUpdates();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');

        await workflows.persistWorkflowSnapshot({
          workflowName,
          runId,
          snapshot: snapshotWithValue(runId, 'a'),
          fence: fenceA,
        });
        if (concurrent) {
          await workflows.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'step-a',
            result: { status: 'success', output: 'a', payload: {}, startedAt: 1, endedAt: 2 } as any,
            requestContext: {},
            fence: fenceA,
          });
          await workflows.updateWorkflowState({ workflowName, runId, opts: { status: 'running' }, fence: fenceA });
        }

        const fenceB = await claimed(runId, 'owner-b', true);

        await expectFenceConflict(
          workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot: snapshotWithValue(runId, 'stale'),
            fence: fenceA,
          }),
        );
        if (concurrent) {
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
        }
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

      it("accepts the released owner's writes until the run is claimed again", async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');
        await workflows.releaseRunOwnership(fenceA);

        await workflows.persistWorkflowSnapshot({
          workflowName,
          runId,
          snapshot: snapshotWithValue(runId, 'late-a'),
          fence: fenceA,
        });
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({ writer: 'late-a' });

        await claimed(runId, 'owner-b');
        await expectFenceConflict(
          workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot: snapshotWithValue(runId, 'stale'),
            fence: fenceA,
          }),
        );
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({ writer: 'late-a' });
      });

      it('fences writes made inside a run fence scope with the fence of the run they write', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const concurrent = workflows.supportsConcurrentUpdates();
        const runId = `run-${randomUUID()}`;
        const otherRunId = `run-${randomUUID()}`;
        const fenceA = await claimed(runId, 'owner-a');
        const fenceB = await claimed(runId, 'owner-b', true);

        const scopeA = recordingScope((store, targetRunId) =>
          store === workflows && targetRunId === runId ? fenceA : undefined,
        );
        await inRunFenceScope(scopeA, async () => {
          await expectFenceConflict(
            workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshotWithValue(runId, 'stale') }),
          );
          if (concurrent) {
            await expectFenceConflict(
              workflows.updateWorkflowState({ workflowName, runId, opts: { status: 'failed' } }),
            );
          }
          // The scope does not cover other runs, and an explicit fence wins over the scope's.
          await workflows.persistWorkflowSnapshot({
            workflowName,
            runId: otherRunId,
            snapshot: snapshotWithValue(otherRunId, 'other'),
          });
          await workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot: snapshotWithValue(runId, 'b'),
            fence: fenceB,
          });
        });

        expect(scopeA.lookups).toContainEqual({ store: workflows, runId });
        expect(scopeA.lookups).toContainEqual({ store: workflows, runId: otherRunId });
        expect(scopeA.conflicts).toEqual(concurrent ? [fenceA, fenceA] : [fenceA]);
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({ writer: 'b' });
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId: otherRunId }))?.value).toEqual({
          writer: 'other',
        });

        const scopeB = recordingScope(store => (store === workflows ? fenceB : undefined));
        await inRunFenceScope(scopeB, () =>
          workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshotWithValue(runId, 'b2') }),
        );
        expect(scopeB.conflicts).toEqual([]);
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({ writer: 'b2' });
      });

      it('leaves writes without a fence unchanged', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
        const runId = `run-${randomUUID()}`;
        await claimed(runId, 'owner-a');

        await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshotWithValue(runId, 'plain') });
        expect((await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({ writer: 'plain' });
      });

      it('never lets a superseded writer overwrite the new owner, even while racing the takeover', async ctx => {
        if (!(await workflows.supportsRunFencing())) return ctx.skip();
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
        // Keep the stale writer going until it starts a write after B's.
        const attemptsAtTakeover = staleAttempts;
        await waitForAttemptAfter(() => staleAttempts, attemptsAtTakeover);
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

    // Fences carry claim generations, which start at the store's clock, so
    // the n-th fence of a run is offset from a clock-sized base.
    const generationBase = Date.now();
    const fence = (runId: string, n: number, ownerId = `owner-${n}`): RunFence => ({
      runId,
      generation: generationBase + n,
      ownerId,
    });

    it('raises monotonically', async ctx => {
      if (!(await memory.supportsRunFencing())) return ctx.skip();
      const runId = `run-${randomUUID()}`;

      expect(await memory.raiseRunFence(fence(runId, 2))).toBe(true);
      expect(await memory.raiseRunFence(fence(runId, 2))).toBe(true);
      expect(await memory.raiseRunFence(fence(runId, 2, 'someone-else'))).toBe(false);
      expect(await memory.raiseRunFence(fence(runId, 1))).toBe(false);
      expect(await memory.raiseRunFence(fence(runId, 3))).toBe(true);
    });

    it('retires only the current fence', async ctx => {
      if (!(await memory.supportsRunFencing())) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);

      expect(await memory.retireRunFence(fenceA)).toBe(false);
      await memory.raiseRunFence(fenceA);
      expect(await memory.retireRunFence({ ...fenceA, ownerId: 'someone-else' })).toBe(false);
      expect(await memory.retireRunFence(fence(runId, 2, fenceA.ownerId))).toBe(false);
      expect(await memory.retireRunFence(fenceA)).toBe(true);
      expect(await memory.retireRunFence(fenceA)).toBe(true);
    });

    it('ignores a late retire from a superseded fence', async ctx => {
      if (!(await memory.supportsRunFencing())) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);
      const fenceB = fence(runId, 2);
      await memory.raiseRunFence(fenceA);
      await memory.raiseRunFence(fenceB);

      expect(await memory.retireRunFence(fenceA)).toBe(false);
      expect(await memory.retireRunFence(fenceB)).toBe(true);
    });

    it('raises and retires a retired fence again', async ctx => {
      if (!(await memory.supportsRunFencing())) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);
      const fenceB = fence(runId, 2);
      await memory.raiseRunFence(fenceA);
      expect(await memory.retireRunFence(fenceA)).toBe(true);

      expect(await memory.raiseRunFence(fenceA)).toBe(true);
      expect(await memory.retireRunFence(fenceA)).toBe(true);
      expect(await memory.raiseRunFence(fenceB)).toBe(true);
      expect(await memory.retireRunFence(fenceB)).toBe(true);
      expect(await memory.raiseRunFence(fenceA)).toBe(false);
    });

    it('keeps accepting writes from a retired fence while it is current', async ctx => {
      if (!(await memory.supportsRunFencing())) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);
      await memory.raiseRunFence(fenceA);
      const thread = createSampleThread();
      await memory.saveThread({ thread, fence: fenceA });
      expect(await memory.retireRunFence(fenceA)).toBe(true);

      await memory.updateThread({ id: thread.id, title: 'retired-a', fence: fenceA });
      await memory.saveMessages({
        messages: [createSampleMessageV2({ threadId: thread.id, resourceId: thread.resourceId })],
        fence: fenceA,
      });
      expect((await memory.getThreadById({ threadId: thread.id }))?.title).toBe('retired-a');
      expect((await memory.listMessages({ threadId: thread.id })).messages).toHaveLength(1);

      await memory.raiseRunFence(fence(runId, 2));
      await expectFenceConflict(memory.updateThread({ id: thread.id, title: 'stale', fence: fenceA }));
    });

    it('accepts writes from the current fence and rejects writes from an older one', async ctx => {
      if (!(await memory.supportsRunFencing())) return ctx.skip();
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

    it('fences writes made inside a run fence scope with the scope fence for this store', async ctx => {
      if (!(await memory.supportsRunFencing())) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);
      const fenceB = fence(runId, 2);
      await memory.raiseRunFence(fenceA);
      const thread = createSampleThread();
      await memory.saveThread({ thread, fence: fenceA });
      await memory.raiseRunFence(fenceB);

      const scopeA = recordingScope(store => (store === memory ? fenceA : undefined));
      await inRunFenceScope(scopeA, async () => {
        await expectFenceConflict(memory.updateThread({ id: thread.id, title: 'stale' }));
        await expectFenceConflict(
          memory.saveMessages({
            messages: [createSampleMessageV2({ threadId: thread.id, resourceId: thread.resourceId })],
          }),
        );
        await expectFenceConflict(memory.updateResource({ resourceId: thread.resourceId, workingMemory: 'stale' }));
      });
      expect(scopeA.lookups.every(lookup => lookup.store === memory)).toBe(true);
      expect(scopeA.conflicts).toEqual([fenceA, fenceA, fenceA]);
      expect((await memory.listMessages({ threadId: thread.id })).messages).toHaveLength(0);

      // A scope that covers another store leaves this store's writes unfenced.
      const elsewhere = recordingScope(store => (store === memory ? undefined : fenceA));
      await inRunFenceScope(elsewhere, () => memory.updateThread({ id: thread.id, title: 'unfenced' }));

      const scopeB = recordingScope(store => (store === memory ? fenceB : undefined));
      await inRunFenceScope(scopeB, () => memory.updateThread({ id: thread.id, title: 'b' }));
      expect(scopeB.conflicts).toEqual([]);
      expect((await memory.getThreadById({ threadId: thread.id }))?.title).toBe('b');
    });

    it('fences atomic working memory merges made inside a run fence scope', async ctx => {
      if (!(await memory.supportsRunFencing()) || !memory.supportsAtomicWorkingMemoryMerge) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);
      const fenceB = fence(runId, 2);
      const resourceId = `resource-${randomUUID()}`;
      await memory.raiseRunFence(fenceA);
      await memory.updateResource({ resourceId, workingMemory: 'a' });
      await memory.raiseRunFence(fenceB);

      const scopeA = recordingScope(store => (store === memory ? fenceA : undefined));
      await inRunFenceScope(scopeA, () =>
        expectFenceConflict(memory.mergeResourceWorkingMemory({ resourceId, merge: () => 'stale' })),
      );
      expect(scopeA.conflicts).toEqual([fenceA]);
      expect((await memory.getResourceById({ resourceId }))?.workingMemory).toBe('a');

      const scopeB = recordingScope(store => (store === memory ? fenceB : undefined));
      await inRunFenceScope(scopeB, () =>
        memory.mergeResourceWorkingMemory({ resourceId, merge: existing => `${existing}b` }),
      );
      expect(scopeB.conflicts).toEqual([]);
      expect((await memory.getResourceById({ resourceId }))?.workingMemory).toBe('ab');
    });

    it('fences observational memory content writes made inside a run fence scope', async ctx => {
      if (!(await memory.supportsRunFencing()) || !memory.supportsObservationalMemory) return ctx.skip();
      const runId = `run-${randomUUID()}`;
      const fenceA = fence(runId, 1);
      const fenceB = fence(runId, 2);
      await memory.raiseRunFence(fenceA);
      const resourceId = `resource-${randomUUID()}`;
      const record = await memory.initializeObservationalMemory({
        threadId: null,
        resourceId,
        scope: 'resource',
        config: { observationThreshold: 5000, reflectionThreshold: 40000 },
      });
      await memory.raiseRunFence(fenceB);

      const scopeA = recordingScope(store => (store === memory ? fenceA : undefined));
      await inRunFenceScope(scopeA, async () => {
        await expectFenceConflict(
          memory.updateActiveObservations({
            id: record.id,
            observations: 'stale',
            tokenCount: 10,
            lastObservedAt: new Date(),
          }),
        );
        await expectFenceConflict(
          memory.updateBufferedObservations({
            id: record.id,
            chunk: {
              cycleId: 'stale-cycle',
              observations: 'stale',
              tokenCount: 10,
              messageIds: [],
              messageTokens: 10,
              lastObservedAt: new Date(),
            },
          }),
        );
        await expectFenceConflict(
          memory.createReflectionGeneration({ currentRecord: record, reflection: 'stale', tokenCount: 10 }),
        );
        // Coordination flags are not fenced, so a superseded owner can still clear its own.
        await memory.setObservingFlag(record.id, true);
        await memory.setObservingFlag(record.id, false);
      });
      expect(scopeA.conflicts).toEqual([fenceA, fenceA, fenceA]);
      const afterStale = await memory.getObservationalMemory(null, resourceId);
      expect(afterStale?.id).toBe(record.id);
      expect(afterStale?.activeObservations).toBe('');
      expect(afterStale?.bufferedObservationChunks ?? []).toHaveLength(0);

      const scopeB = recordingScope(store => (store === memory ? fenceB : undefined));
      await inRunFenceScope(scopeB, () =>
        memory.updateActiveObservations({
          id: record.id,
          observations: 'b',
          tokenCount: 10,
          lastObservedAt: new Date(),
        }),
      );
      expect(scopeB.conflicts).toEqual([]);
      expect((await memory.getObservationalMemory(null, resourceId))?.activeObservations).toBe('b');
    });

    it('leaves writes without a fence unchanged', async ctx => {
      if (!(await memory.supportsRunFencing())) return ctx.skip();
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
      if (!(await memory.supportsRunFencing())) return ctx.skip();
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
      await waitForAttemptAfter(() => staleAttempts, attemptsAtTakeover);
      stop = true;
      await staleWriter;

      expect(staleAttempts).toBeGreaterThan(attemptsAtTakeover);
      const { messages } = await memory.listMessages({ threadId: thread.id });
      expect(messages).toHaveLength(1);
      expect(messages[0]!.content.content).toBe('b');
    });
  });
}
