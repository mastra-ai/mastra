import { randomUUID } from 'node:crypto';
import type {
  AgentSignalScope,
  AgentSignalsStorage,
  MastraStorage,
  StoredAgentSignal,
  StoredAgentSignalPayload,
} from '@mastra/core/storage';
import { beforeAll, describe, expect, it } from 'vitest';

export interface AgentSignalsTestOptions {
  storage: MastraStorage;
  /**
   * A second storage instance on the same database, standing in for another
   * process. When given, the race tests send their concurrent calls through
   * both instances; otherwise everything goes through `storage`.
   */
  peerStorage?: MastraStorage;
}

const RACE_ITERATIONS = 25;
const RACE_ROWS = 8;

const idsOf = (rows: StoredAgentSignal[]) => rows.map(row => row.id);
const sorted = (ids: string[]) => [...ids].sort();
const newThread = () => `thread-${randomUUID()}`;
const newRun = () => `run-${randomUUID()}`;

function payload(id: string, text = `signal ${id}`): StoredAgentSignalPayload {
  return {
    id,
    type: 'user',
    contents: [{ type: 'text', text }],
    createdAt: '2026-01-01T00:00:00.000Z',
    attributes: { priority: 1, urgent: true, note: null },
  };
}

async function signalsOf(storage: MastraStorage): Promise<AgentSignalsStorage> {
  await storage.init();
  const store = await storage.getStore('agentSignals');
  if (!store) throw new Error(`${storage.constructor.name} does not provide the agentSignals domain`);
  return store;
}

/**
 * Conformance suite for {@link AgentSignalsStorage}. Every implementation runs
 * it against its real backend. The storage must provide the `agentSignals`
 * domain; the suite fails when it is missing.
 *
 * `dangerouslyClearAll` is exercised and clears the whole domain, so the suite
 * needs a database (or schema) that no other test file uses at the same time.
 */
export function createAgentSignalsTests({ storage, peerStorage }: AgentSignalsTestOptions) {
  describe('Agent signals', () => {
    let signals: AgentSignalsStorage;
    let peer: AgentSignalsStorage;

    beforeAll(async () => {
      signals = await signalsOf(storage);
      peer = peerStorage ? await signalsOf(peerStorage) : signals;
    });

    const enqueueOn = (
      store: AgentSignalsStorage,
      threadKey: string,
      runId: string | null,
      scope: AgentSignalScope,
      id: string = randomUUID(),
    ) => store.enqueue({ id, threadKey, runId, scope, signal: payload(id) }).then(result => ({ id, result }));
    const enqueue = (threadKey: string, runId: string | null, scope: AgentSignalScope, id?: string) =>
      enqueueOn(signals, threadKey, runId, scope, id);

    /** True when the id has no row at all: storing it again as a leftover creates a new pending row. */
    async function isGone(threadKey: string, id: string) {
      await enqueue(threadKey, null, 'pending', id);
      return idsOf(await signals.listPending({ threadKey, runId: null })).includes(id);
    }

    it('reports whether it is shared across processes', () => {
      expect(typeof signals.sharedAcrossProcesses).toBe('boolean');
    });

    describe('enqueue', () => {
      it('stores the signal as a pending row of the run', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const { id, result } = await enqueue(threadKey, runId, 'pending');

        expect(result).toBe('accepted');
        const [row, ...rest] = await signals.listPending({ threadKey });
        expect(rest).toEqual([]);
        expect(row).toMatchObject({ id, threadKey, runId, scope: 'pending', claimedBy: null, signal: payload(id) });
        expect(row!.createdAt).toBeInstanceOf(Date);
        expect(Number.isNaN(row!.createdAt.getTime())).toBe(false);
      });

      it('keeps the first row when the same id is enqueued again for another run, thread or scope', async () => {
        const threadKey = newThread();
        const otherThread = newThread();
        const runId = newRun();
        const id = randomUUID();

        expect(await signals.enqueue({ id, threadKey, runId, scope: 'pending', signal: payload(id, 'first') })).toBe(
          'accepted',
        );
        expect(
          await signals.enqueue({
            id,
            threadKey: otherThread,
            runId: newRun(),
            scope: 'pre-run',
            signal: payload(id, 'second'),
          }),
        ).toBe('accepted');

        const rows = await signals.listPending({ threadKey });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ id, runId, scope: 'pending', signal: payload(id, 'first') });
        expect(await signals.listPending({ threadKey: otherThread })).toEqual([]);
      });

      it('rejects a signal for a closed run and stores nothing', async () => {
        const threadKey = newThread();
        const runId = newRun();
        await signals.closeRun({ threadKey, runId, consumedIds: [] });

        const rejected = await enqueue(threadKey, runId, 'pending');
        expect(rejected.result).toBe('run-closed');
        expect(await signals.listPending({ threadKey })).toEqual([]);
        expect(await isGone(threadKey, rejected.id)).toBe(true);
      });

      it('checks for a closed run before checking for an existing id', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const leftover = await enqueue(threadKey, null, 'pending');
        await signals.closeRun({ threadKey, runId, consumedIds: [] });

        expect((await enqueue(threadKey, runId, 'pending', leftover.id)).result).toBe('run-closed');
        expect(idsOf(await signals.listPending({ threadKey, runId: null }))).toEqual([leftover.id]);
      });

      it('accepts a leftover on a thread whose runs are all closed', async () => {
        const threadKey = newThread();
        const runId = newRun();
        await enqueue(threadKey, runId, 'pending');
        await signals.closeRun({ threadKey, runId, consumedIds: [] });

        expect((await enqueue(threadKey, null, 'pre-run')).result).toBe('accepted');
        expect(await signals.listPending({ threadKey, runId: null })).toHaveLength(2);
      });

      it('never loses an accepted signal when sends race with the run closing', async () => {
        for (let iteration = 0; iteration < RACE_ITERATIONS; iteration++) {
          const threadKey = newThread();
          const runId = newRun();
          const ids = Array.from({ length: RACE_ROWS }, (): string => randomUUID());
          const consumedIds = ids.filter((_, index) => index % 2 === 0);

          // Start the close at a different point among the sends on each iteration.
          const closeAt = iteration % (RACE_ROWS + 1);
          const send = (id: string) => enqueueOn(signals, threadKey, runId, 'pending', id);
          const before = ids.slice(0, closeAt).map(send);
          const close = peer.closeRun({ threadKey, runId, consumedIds });
          const after = ids.slice(closeAt).map(send);
          const [results] = await Promise.all([Promise.all([...before, ...after]), close]);

          const leftovers = new Set(idsOf(await signals.listPending({ threadKey, runId: null })));
          expect(await signals.listPending({ threadKey, runId })).toEqual([]);
          for (const { id, result } of results) {
            const shouldRemain = result === 'accepted' && !consumedIds.includes(id);
            expect({ id, result, leftover: leftovers.has(id) }).toEqual({ id, result, leftover: shouldRemain });
          }

          // Ids that are not leftovers must have no row at all, not a hidden one.
          for (const id of ids.filter(id => !leftovers.has(id))) await enqueue(threadKey, null, 'pending', id);
          expect(sorted(idsOf(await signals.listPending({ threadKey, runId: null })))).toEqual(sorted(ids));
        }
      });
    });

    describe('claim', () => {
      it('returns the rows claimed earlier plus newly claimed ones', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const first = await enqueue(threadKey, runId, 'pre-run');
        const second = await enqueue(threadKey, runId, 'pre-run');

        const claimed = await signals.claim({ threadKey, runId, scope: 'pre-run' });
        expect(idsOf(claimed)).toEqual([first.id, second.id]);
        expect(claimed.every(row => row.claimedBy === runId && row.runId === runId)).toBe(true);
        expect(await signals.claim({ threadKey, runId, scope: 'pre-run' })).toEqual(claimed);

        const third = await enqueue(threadKey, runId, 'pre-run');
        expect(idsOf(await signals.claim({ threadKey, runId, scope: 'pre-run' }))).toEqual([
          first.id,
          second.id,
          third.id,
        ]);
        expect(await signals.listPending({ threadKey })).toEqual([]);
      });

      it('claims only rows of the requested scope', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const preRun = await enqueue(threadKey, runId, 'pre-run');
        const pending = await enqueue(threadKey, runId, 'pending');

        expect(idsOf(await signals.claim({ threadKey, runId, scope: 'pre-run' }))).toEqual([preRun.id]);
        expect(idsOf(await signals.listPending({ threadKey, runId }))).toEqual([pending.id]);
        expect(idsOf(await signals.claim({ threadKey, runId, scope: 'pending' }))).toEqual([pending.id]);
        expect(idsOf(await signals.claim({ threadKey, runId, scope: 'pre-run' }))).toEqual([preRun.id]);
      });

      it('does not claim rows of other runs or other threads without a takeover', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const other = await enqueue(threadKey, newRun(), 'pre-run');
        const leftover = await enqueue(threadKey, null, 'pre-run');
        const elsewhere = newThread();
        await enqueue(elsewhere, newRun(), 'pre-run');

        expect(await signals.claim({ threadKey, runId, scope: 'pre-run' })).toEqual([]);
        expect(idsOf(await signals.listPending({ threadKey }))).toEqual([other.id, leftover.id]);
        expect(await signals.listPending({ threadKey: elsewhere })).toHaveLength(1);
      });

      it('returns nothing for a closed run', async () => {
        const threadKey = newThread();
        const runId = newRun();
        await signals.closeRun({ threadKey, runId, consumedIds: [] });

        expect(await signals.claim({ threadKey, runId, scope: 'pending' })).toEqual([]);
      });

      it('never leaves a row claimed by a closed run when a claim races with the close', async () => {
        for (let iteration = 0; iteration < RACE_ITERATIONS; iteration++) {
          const threadKey = newThread();
          const runId = newRun();
          const ids: string[] = [];
          for (let index = 0; index < RACE_ROWS; index++) ids.push((await enqueue(threadKey, runId, 'pending')).id);
          const consumedIds = ids.filter((_, index) => index % 2 === 0);
          const released = ids.filter(id => !consumedIds.includes(id));

          const claim = () => signals.claim({ threadKey, runId, scope: 'pending' });
          const close = () => peer.closeRun({ threadKey, runId, consumedIds });
          let claimed: StoredAgentSignal[];
          if (iteration % 2 === 0) [claimed] = await Promise.all([claim(), close()]);
          else [, claimed] = await Promise.all([close(), claim()]);

          // The claim ran entirely before the close or entirely after it.
          expect([[], ids]).toContainEqual(idsOf(claimed));
          expect(idsOf(await signals.listPending({ threadKey, runId: null }))).toEqual(released);
          expect(await signals.listPending({ threadKey, runId })).toEqual([]);
          expect(await signals.claim({ threadKey, runId, scope: 'pending' })).toEqual([]);
        }
      });
    });

    describe('claim with a takeover', () => {
      it('takes over the thread: moves leftovers and unclaimed rows, deletes claimed rows, closes other runs', async () => {
        const threadKey = newThread();
        const claimer = newRun();
        const idleRun = newRun();
        const busyRun = newRun();

        const leftover = await enqueue(threadKey, null, 'pending');
        const idle = await enqueue(threadKey, idleRun, 'pending');
        const busyClaimed = await enqueue(threadKey, busyRun, 'pending');
        await signals.claim({ threadKey, runId: busyRun, scope: 'pending' });
        const busyUnclaimed = await enqueue(threadKey, busyRun, 'pending');
        const idlePreRun = await enqueue(threadKey, idleRun, 'pre-run');
        const own = await enqueue(threadKey, claimer, 'pre-run');
        const ownPending = await enqueue(threadKey, claimer, 'pending');

        const elsewhere = newThread();
        const elsewhereRun = newRun();
        const foreign = await enqueue(elsewhere, elsewhereRun, 'pending');
        const foreignLeftover = await enqueue(elsewhere, null, 'pre-run');

        const claimed = await signals.claim({ threadKey, runId: claimer, scope: 'pre-run', leftovers: true });
        expect(idsOf(claimed)).toEqual([leftover.id, idle.id, busyUnclaimed.id, idlePreRun.id, own.id]);
        expect(
          claimed.every(row => row.runId === claimer && row.claimedBy === claimer && row.scope === 'pre-run'),
        ).toBe(true);
        expect(await signals.claim({ threadKey, runId: claimer, scope: 'pre-run', leftovers: true })).toEqual(claimed);

        expect(idsOf(await signals.listPending({ threadKey }))).toEqual([ownPending.id]);
        expect((await enqueue(threadKey, idleRun, 'pending')).result).toBe('run-closed');
        expect((await enqueue(threadKey, busyRun, 'pending')).result).toBe('run-closed');
        expect(await signals.claim({ threadKey, runId: busyRun, scope: 'pending' })).toEqual([]);

        expect(idsOf(await signals.listPending({ threadKey: elsewhere }))).toEqual([foreign.id, foreignLeftover.id]);
        expect((await enqueue(elsewhere, elsewhereRun, 'pending')).result).toBe('accepted');

        expect(await isGone(threadKey, busyClaimed.id)).toBe(true);
      });

      it('changes nothing when the claiming run is closed', async () => {
        const threadKey = newThread();
        const claimer = newRun();
        const otherRun = newRun();
        const leftover = await enqueue(threadKey, null, 'pre-run');
        const other = await enqueue(threadKey, otherRun, 'pending');
        await signals.closeRun({ threadKey, runId: claimer, consumedIds: [] });

        expect(await signals.claim({ threadKey, runId: claimer, scope: 'pre-run', leftovers: true })).toEqual([]);

        expect(idsOf(await signals.listPending({ threadKey, runId: null }))).toEqual([leftover.id]);
        expect(idsOf(await signals.listPending({ threadKey, runId: otherRun }))).toEqual([other.id]);
        expect((await enqueue(threadKey, otherRun, 'pending')).result).toBe('accepted');
      });
    });

    describe('delete', () => {
      it('deletes the given rows and ignores missing ids', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const consumed = await enqueue(threadKey, runId, 'pending');
        const kept = await enqueue(threadKey, runId, 'pending');
        await signals.claim({ threadKey, runId, scope: 'pending' });

        await signals.delete({ ids: [consumed.id, randomUUID()] });
        await signals.delete({ ids: [] });

        expect(idsOf(await signals.claim({ threadKey, runId, scope: 'pending' }))).toEqual([kept.id]);
      });
    });

    describe('closeRun', () => {
      it('deletes consumed rows and releases the rest as leftovers with their scope', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const otherRun = newRun();

        const consumed = await enqueue(threadKey, runId, 'pending');
        const claimedNotConsumed = await enqueue(threadKey, runId, 'pending');
        await signals.claim({ threadKey, runId, scope: 'pending' });
        const neverClaimedPreRun = await enqueue(threadKey, runId, 'pre-run');
        const neverClaimed = await enqueue(threadKey, runId, 'pending');
        const otherRunRow = await enqueue(threadKey, otherRun, 'pending');
        const leftover = await enqueue(threadKey, null, 'pending');
        const elsewhere = newThread();
        const elsewhereRun = newRun();
        const foreign = await enqueue(elsewhere, elsewhereRun, 'pending');

        const close = {
          threadKey,
          runId,
          consumedIds: [consumed.id, otherRunRow.id, leftover.id, foreign.id],
        };
        await signals.closeRun(close);

        const leftovers = await signals.listPending({ threadKey, runId: null });
        expect(leftovers.map(row => [row.id, row.scope])).toEqual([
          [claimedNotConsumed.id, 'pending'],
          [neverClaimedPreRun.id, 'pre-run'],
          [neverClaimed.id, 'pending'],
          [leftover.id, 'pending'],
        ]);
        expect(leftovers.every(row => row.runId === null && row.claimedBy === null)).toBe(true);
        expect(idsOf(await signals.listPending({ threadKey, runId: otherRun }))).toEqual([otherRunRow.id]);
        expect(idsOf(await signals.listPending({ threadKey: elsewhere, runId: elsewhereRun }))).toEqual([foreign.id]);

        await signals.closeRun(close);
        expect(await signals.listPending({ threadKey, runId: null })).toEqual(leftovers);
        expect((await enqueue(threadKey, runId, 'pending')).result).toBe('run-closed');
        expect(await isGone(threadKey, consumed.id)).toBe(true);
      });

      it('deletes newly listed consumed rows when an already closed run is closed again', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const first = await enqueue(threadKey, runId, 'pending');
        const second = await enqueue(threadKey, runId, 'pending');
        await signals.claim({ threadKey, runId, scope: 'pending' });
        // Handing the run's rows over closes it while its claimed rows stay addressed to it.
        expect(await signals.readdress({ threadKey, fromRunId: runId, toRunId: newRun() })).toBe('accepted');
        expect((await enqueue(threadKey, runId, 'pending')).result).toBe('run-closed');

        await signals.closeRun({ threadKey, runId, consumedIds: [first.id] });

        expect(idsOf(await signals.listPending({ threadKey, runId: null }))).toEqual([second.id]);
        expect(await isGone(threadKey, first.id)).toBe(true);
      });

      it('closes a run that has no rows', async () => {
        const threadKey = newThread();
        const runId = newRun();

        await signals.closeRun({ threadKey, runId, consumedIds: [randomUUID()] });

        expect((await enqueue(threadKey, runId, 'pre-run')).result).toBe('run-closed');
        expect(await signals.listPending({ threadKey })).toEqual([]);
      });
    });

    describe('cancel', () => {
      it('deletes unclaimed rows of the thread and returns only what it deleted', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const claimed = await enqueue(threadKey, runId, 'pre-run');
        await signals.claim({ threadKey, runId, scope: 'pre-run' });
        const first = await enqueue(threadKey, runId, 'pending');
        const second = await enqueue(threadKey, null, 'pending');
        const untouched = await enqueue(threadKey, runId, 'pending');
        const elsewhere = newThread();
        const foreign = await enqueue(elsewhere, null, 'pending');

        const cancelled = await signals.cancel({
          threadKey,
          ids: [claimed.id, first.id, second.id, foreign.id, randomUUID(), first.id],
        });

        expect(sorted(cancelled)).toEqual(sorted([first.id, second.id]));
        expect(await signals.cancel({ threadKey, ids: [first.id, second.id] })).toEqual([]);
        expect(idsOf(await signals.listPending({ threadKey }))).toEqual([untouched.id]);
        expect(idsOf(await signals.claim({ threadKey, runId, scope: 'pre-run' }))).toEqual([claimed.id]);
        expect(idsOf(await signals.listPending({ threadKey: elsewhere }))).toEqual([foreign.id]);
      });

      it('lets a cancelled id be enqueued again', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const { id } = await enqueue(threadKey, runId, 'pending');
        expect(await signals.cancel({ threadKey, ids: [id] })).toEqual([id]);

        expect((await enqueue(threadKey, runId, 'pending', id)).result).toBe('accepted');
        expect(idsOf(await signals.listPending({ threadKey, runId }))).toEqual([id]);
      });
    });

    describe('readdress', () => {
      it('moves unclaimed rows to an open run, keeping scope and order, and closes the source', async () => {
        const threadKey = newThread();
        const fromRunId = newRun();
        const toRunId = newRun();

        const existing = await enqueue(threadKey, toRunId, 'pending');
        const claimed = await enqueue(threadKey, fromRunId, 'pre-run');
        await signals.claim({ threadKey, runId: fromRunId, scope: 'pre-run' });
        const pending = await enqueue(threadKey, fromRunId, 'pending');
        const preRun = await enqueue(threadKey, fromRunId, 'pre-run');

        expect(await signals.readdress({ threadKey, fromRunId, toRunId })).toBe('accepted');

        const moved = await signals.listPending({ threadKey, runId: toRunId });
        expect(moved.map(row => [row.id, row.scope])).toEqual([
          [existing.id, 'pending'],
          [pending.id, 'pending'],
          [preRun.id, 'pre-run'],
        ]);
        expect(await signals.listPending({ threadKey, runId: fromRunId })).toEqual([]);
        expect((await enqueue(threadKey, fromRunId, 'pending')).result).toBe('run-closed');
        expect((await enqueue(threadKey, toRunId, 'pending')).result).toBe('accepted');
        expect(idsOf(await signals.claim({ threadKey, runId: toRunId, scope: 'pre-run' }))).toEqual([preRun.id]);

        // The source's claimed row is released by its own close.
        await signals.closeRun({ threadKey, runId: fromRunId, consumedIds: [] });
        expect(idsOf(await signals.listPending({ threadKey, runId: null }))).toEqual([claimed.id]);
      });

      it('deletes the rows and closes the source when the target is closed', async () => {
        const threadKey = newThread();
        const fromRunId = newRun();
        const toRunId = newRun();
        const row = await enqueue(threadKey, fromRunId, 'pending');
        await signals.closeRun({ threadKey, runId: toRunId, consumedIds: [] });

        expect(await signals.readdress({ threadKey, fromRunId, toRunId })).toBe('run-closed');

        expect(await signals.listPending({ threadKey })).toEqual([]);
        expect((await enqueue(threadKey, fromRunId, 'pending')).result).toBe('run-closed');
        expect(await isGone(threadKey, row.id)).toBe(true);
      });

      it('reports the state of the run and changes nothing when source and target are the same', async () => {
        const threadKey = newThread();
        const openRun = newRun();
        const row = await enqueue(threadKey, openRun, 'pending');

        expect(await signals.readdress({ threadKey, fromRunId: openRun, toRunId: openRun })).toBe('accepted');
        expect(idsOf(await signals.listPending({ threadKey, runId: openRun }))).toEqual([row.id]);
        expect((await enqueue(threadKey, openRun, 'pending')).result).toBe('accepted');

        const closedRun = newRun();
        await signals.closeRun({ threadKey, runId: closedRun, consumedIds: [] });
        expect(await signals.readdress({ threadKey, fromRunId: closedRun, toRunId: closedRun })).toBe('run-closed');
      });
    });

    describe('listPending', () => {
      it('lists pending rows of a run, the leftovers, or the whole thread', async () => {
        const threadKey = newThread();
        const runA = newRun();
        const runB = newRun();

        const a = await enqueue(threadKey, runA, 'pending');
        const leftover = await enqueue(threadKey, null, 'pre-run');
        await enqueue(threadKey, runA, 'pre-run');
        await signals.claim({ threadKey, runId: runA, scope: 'pre-run' });
        const b = await enqueue(threadKey, runB, 'pre-run');
        await enqueue(newThread(), newRun(), 'pending');

        expect(idsOf(await signals.listPending({ threadKey, runId: runA }))).toEqual([a.id]);
        expect(idsOf(await signals.listPending({ threadKey, runId: null }))).toEqual([leftover.id]);
        expect(idsOf(await signals.listPending({ threadKey }))).toEqual([a.id, leftover.id, b.id]);
        expect(await signals.listPending({ threadKey: newThread() })).toEqual([]);
      });
    });

    describe('run markers', () => {
      it('keeps the same run id on two threads independent', async () => {
        const threadA = newThread();
        const threadB = newThread();
        const runId = newRun();
        const a = await enqueue(threadA, runId, 'pending');
        const b = await enqueue(threadB, runId, 'pending');

        await signals.closeRun({ threadKey: threadA, runId, consumedIds: [b.id] });

        expect(idsOf(await signals.listPending({ threadKey: threadA, runId: null }))).toEqual([a.id]);
        expect(idsOf(await signals.listPending({ threadKey: threadB, runId }))).toEqual([b.id]);
        expect((await enqueue(threadA, runId, 'pending')).result).toBe('run-closed');
        expect((await enqueue(threadB, runId, 'pending')).result).toBe('accepted');
        expect(await signals.claim({ threadKey: threadA, runId, scope: 'pending' })).toEqual([]);
        expect(idsOf(await signals.claim({ threadKey: threadB, runId, scope: 'pending' }))).toHaveLength(2);
      });
    });

    describe('ordering', () => {
      it('returns sequentially inserted rows in call order', async () => {
        const threadKey = newThread();
        const runId = newRun();

        const ids: string[] = [];
        for (let index = 0; index < 20; index++) {
          ids.push((await enqueue(threadKey, runId, index % 2 === 0 ? 'pending' : 'pre-run')).id);
        }

        expect(idsOf(await signals.listPending({ threadKey, runId }))).toEqual(ids);
        expect(idsOf(await signals.claim({ threadKey, runId, scope: 'pending' }))).toEqual(
          ids.filter((_, index) => index % 2 === 0),
        );
        await signals.closeRun({ threadKey, runId, consumedIds: [] });
        expect(idsOf(await signals.listPending({ threadKey, runId: null }))).toEqual(ids);
        expect(idsOf(await signals.claim({ threadKey, runId: newRun(), scope: 'pre-run', leftovers: true }))).toEqual(
          ids,
        );
      });

      it('returns concurrently inserted rows in the same order on every read', async () => {
        const threadKey = newThread();
        const runId = newRun();
        const ids = Array.from({ length: 20 }, (): string => randomUUID());

        await Promise.all(ids.map(id => enqueue(threadKey, runId, 'pending', id)));

        const order = idsOf(await signals.listPending({ threadKey, runId }));
        expect(sorted(order)).toEqual(sorted(ids));
        expect(idsOf(await signals.listPending({ threadKey }))).toEqual(order);
        expect(idsOf(await peer.listPending({ threadKey, runId }))).toEqual(order);
        expect(idsOf(await signals.claim({ threadKey, runId, scope: 'pending' }))).toEqual(order);
        await signals.closeRun({ threadKey, runId, consumedIds: [] });
        expect(idsOf(await signals.listPending({ threadKey, runId: null }))).toEqual(order);
      });
    });

    describe('deleteThread', () => {
      it('removes rows and run markers of the thread only', async () => {
        const threadKey = newThread();
        const closedRun = newRun();
        const openRun = newRun();
        await enqueue(threadKey, closedRun, 'pending');
        await enqueue(threadKey, openRun, 'pre-run');
        await enqueue(threadKey, null, 'pending');
        await signals.closeRun({ threadKey, runId: closedRun, consumedIds: [] });

        const otherThread = newThread();
        const otherClosedRun = newRun();
        const otherRow = await enqueue(otherThread, null, 'pending');
        await signals.closeRun({ threadKey: otherThread, runId: otherClosedRun, consumedIds: [] });

        await signals.deleteThread({ threadKey });

        expect(await signals.listPending({ threadKey })).toEqual([]);
        expect(await signals.claim({ threadKey, runId: openRun, scope: 'pre-run' })).toEqual([]);
        expect((await enqueue(threadKey, closedRun, 'pending')).result).toBe('accepted');
        expect(idsOf(await signals.listPending({ threadKey: otherThread }))).toEqual([otherRow.id]);
        expect((await enqueue(otherThread, otherClosedRun, 'pending')).result).toBe('run-closed');
      });
    });

    describe('dangerouslyClearAll', () => {
      it('removes every row and run marker', async () => {
        const threadKey = newThread();
        const closedRun = newRun();
        await enqueue(threadKey, null, 'pending');
        await signals.closeRun({ threadKey, runId: closedRun, consumedIds: [] });

        await signals.dangerouslyClearAll();

        expect(await signals.listPending({ threadKey })).toEqual([]);
        expect((await enqueue(threadKey, closedRun, 'pending')).result).toBe('accepted');
      });
    });
  });
}
