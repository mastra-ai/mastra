import { randomUUID } from 'node:crypto';
import { createSampleMessageV2, createSampleThread } from '@internal/storage-test-utils';
import { createSignal } from '@mastra/core/agent';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';
import { Pool } from 'pg';
import type { PoolConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { connectionString } from '../../test-utils';

// Postgres-specific behavior of pending agent signals. The shared conformance tests run from
// `index.test.ts`; these cover isolation levels, lock ordering, counts, schema upgrades and
// parameters.

const ITERATIONS = 30;
const RACE_TIMEOUT = 30_000;
const REPEATABLE_READ: PoolConfig = { options: '-c default_transaction_isolation=repeatable\\ read' };

const newRun = () => `run-${randomUUID()}`;
// Short enough that schema-prefixed index names stay under Postgres's 63-byte identifier limit.
const newSchema = (name: string) => `signals_${name}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
const ids = (messages: MastraDBMessage[]) => messages.map(message => message.id);
const sorted = (values: string[]) => [...values].sort();
const reversed = <T>(values: T[]) => [...values].reverse();

// Signals are claimed in createdAt order, so each one gets its own millisecond.
let clock = Date.now() - 600_000;
const nextCreatedAt = () => new Date(++clock);

async function memoryOf(store: PostgresStore): Promise<MemoryStorage> {
  await store.init();
  const memory = await store.getStore('memory');
  if (!memory) throw new Error('PostgresStore does not provide the memory domain');
  return memory;
}

/** Every `code` along an error's cause chain, such as `40P01` for a deadlock. */
function codesOf(error: unknown): string[] {
  const codes: string[] = [];
  for (let current = error; current && typeof current === 'object'; current = (current as { cause?: unknown }).cause) {
    const { code } = current as { code?: unknown };
    if (typeof code === 'string') codes.push(code);
  }
  return codes;
}

/** Runs `calls` at once, starting them in an order that shifts with `iteration`. */
function startShifted<T>(calls: (() => Promise<T>)[], iteration: number): Promise<PromiseSettledResult<T>[]> {
  const shift = iteration % calls.length;
  return Promise.allSettled([...calls.slice(shift), ...calls.slice(0, shift)].map(call => call()));
}

/**
 * Two stores with their own pools on one database and a schema of their own, standing in for two
 * processes. The schema is dropped afterwards.
 */
function twoProcesses(name: string, poolConfig: PoolConfig = {}) {
  const schemaName = newSchema(name);
  const pools = [0, 1].map(() => new Pool({ connectionString, ...poolConfig }));
  const stores = pools.map((pool, index) => new PostgresStore({ id: `signals-${name}-${index}`, pool, schemaName }));
  const ctx = {
    schemaName,
    pool: pools[0]!,
    memory: undefined as unknown as MemoryStorage,
    peer: undefined as unknown as MemoryStorage,
    messagesTable: `"${schemaName}"."mastra_messages"`,
  };

  beforeAll(async () => {
    ctx.memory = await memoryOf(stores[0]!);
    ctx.peer = await memoryOf(stores[1]!);
  });

  afterAll(async () => {
    try {
      await Promise.allSettled(stores.map(store => store.close()));
      await pools[0]!.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await Promise.allSettled(pools.map(pool => pool.end()));
    }
  });

  return ctx;
}

type Ctx = ReturnType<typeof twoProcesses>;

function helpers(ctx: Ctx) {
  const newThread = async (resourceId?: string) =>
    ctx.memory.saveThread({
      thread: createSampleThread({ resourceId, date: new Date(Date.now() - 60_000) }) as StorageThreadType,
    });
  const startRun = async (thread: StorageThreadType, runId = newRun()) => {
    await ctx.memory.setSignalRun({ threadId: thread.id, runId });
    return runId;
  };
  const signalFor = (thread: StorageThreadType, { id, createdAt }: { id?: string; createdAt?: Date } = {}) =>
    createSignal({ type: 'user', id, contents: 'a signal', createdAt: createdAt ?? nextCreatedAt() }).toDBMessage({
      threadId: thread.id,
      resourceId: thread.resourceId,
    });
  const send = async (thread: StorageThreadType, options: { id?: string; createdAt?: Date } = {}) => {
    const message = signalFor(thread, options);
    expect(await ctx.memory.enqueuePendingSignal({ message })).toBe('accepted');
    return message;
  };
  const sendMany = async (thread: StorageThreadType, count: number) => {
    const messages: MastraDBMessage[] = [];
    for (let index = 0; index < count; index++) messages.push(await send(thread));
    return messages;
  };
  const claim = (thread: StorageThreadType, runId: string, consumedIds: string[] = [], store = ctx.memory) =>
    store.claimPendingSignals({ threadId: thread.id, runId, consumedIds });
  const pendingIds = async (thread: StorageThreadType) =>
    ids(await ctx.memory.listPendingSignals({ threadId: thread.id }));
  /** The thread's rows straight from the table, with the columns the store never returns. */
  const rowsOf = async (thread: StorageThreadType) =>
    (
      await ctx.pool.query<{ id: string; status: string | null; claimedBy: string | null }>(
        `SELECT id, "signalStatus" AS status, "signalClaimedBy" AS "claimedBy"
         FROM ${ctx.messagesTable} WHERE thread_id = $1 ORDER BY id`,
        [thread.id],
      )
    ).rows;
  const claimedBy = async (thread: StorageThreadType, runId: string) =>
    (await rowsOf(thread)).filter(row => row.claimedBy === runId).map(row => row.id);
  const existing = async (messageIds: string[]) =>
    (
      await ctx.pool.query<{ id: string }>(`SELECT id FROM ${ctx.messagesTable} WHERE id = ANY($1)`, [messageIds])
    ).rows.map(row => row.id);
  return { newThread, startRun, signalFor, send, sendMany, claim, pendingIds, rowsOf, claimedBy, existing };
}

/** Races across two processes; run on pools with the default isolation level and with REPEATABLE READ. */
function raceTests(ctx: Ctx) {
  const { newThread, startRun, signalFor, sendMany, claim, pendingIds, rowsOf, claimedBy, existing } = helpers(ctx);

  /**
   * A thread whose signal run claimed four rows, two of which were then saved as messages, and
   * that has four more pending.
   */
  async function threadWithSignals() {
    const thread = await newThread();
    const runId = await startRun(thread);
    const claimed = await sendMany(thread, 4);
    await claim(thread, runId);
    await ctx.memory.saveMessages({ messages: [claimed[1]!, claimed[2]!] });
    const pending = await sendMany(thread, 4);
    return { thread, runId, claimed, pending, all: [...claimed, ...pending] };
  }

  it(
    'leaves no row claimed by a run whose close races its claims and sends',
    async () => {
      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const thread = await newThread();
        const runId = await startRun(thread);
        const early = ids(await sendMany(thread, 4));
        expect(ids(await claim(thread, runId))).toEqual(early);
        const consumed = early.slice(0, 2);
        // Rows the racing claims can take at once, and sends that may land before or after the close.
        const waiting = ids(await sendMany(thread, 3));
        const late = Array.from({ length: 6 }, () => signalFor(thread));

        const sendResults: { id: string; result: string }[] = [];
        const sends = late.map((message, index) => async () => {
          const store = index % 2 === 0 ? ctx.memory : ctx.peer;
          sendResults.push({ id: message.id, result: await store.enqueuePendingSignal({ message, toRunId: runId }) });
        });
        const claims = [ctx.memory, ctx.peer].map(store => async () => {
          await claim(thread, runId, consumed, store);
        });
        const close = () => ctx.peer.closeSignalRun({ threadId: thread.id, runId, consumedIds: consumed });
        // The close starts at a different point among the claims and sends on each iteration.
        const others = [...sends, ...claims];
        const at = iteration % (others.length + 1);
        const results = await Promise.allSettled([...others.slice(0, at), close, ...others.slice(at)].map(c => c()));

        expect(results.filter(result => result.status === 'rejected')).toEqual([]);
        expect(await claimedBy(thread, runId)).toEqual([]);
        expect(await ctx.memory.getSignalRun({ threadId: thread.id })).toBeNull();
        // Consumed rows are gone, the run's other rows are pending again, and a late send is
        // either pending or was answered run-closed and left no row.
        const accepted = sendResults.filter(({ result }) => result === 'accepted').map(({ id }) => id);
        const refused = sendResults.filter(({ result }) => result === 'run-closed').map(({ id }) => id);
        expect(accepted.length + refused.length).toBe(late.length);
        expect(sorted(await pendingIds(thread))).toEqual(sorted([...early.slice(2), ...waiting, ...accepted]));
        expect(await existing([...consumed, ...refused])).toEqual([]);
      }
    },
    RACE_TIMEOUT,
  );

  it(
    'settles claims, a close, a cancel, saves, updates, deletes and a transfer of the same rows without a deadlock',
    async () => {
      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const { thread, runId, claimed, pending, all } = await threadWithSignals();

        // Overlapping rows, each call naming them in an order other than the lock order.
        const results = await startShifted<unknown>(
          [
            () => claim(thread, runId),
            () => ctx.peer.closeSignalRun({ threadId: thread.id, runId, consumedIds: [claimed[0]!.id] }),
            () => ctx.memory.cancelPendingSignals({ threadId: thread.id, ids: reversed(ids(all)) }),
            () => ctx.peer.saveMessages({ messages: reversed([claimed[1]!, claimed[2]!, pending[0]!, pending[1]!]) }),
            () =>
              ctx.peer.updateMessages({
                messages: reversed(all).map(message => ({ id: message.id, content: { metadata: { updated: true } } })),
              }),
            () => ctx.memory.deleteMessages(reversed([claimed[3]!.id, pending[1]!.id, pending[2]!.id])),
            () => ctx.peer.updateThreadResourceId({ threadId: thread.id, resourceId: `resource-${randomUUID()}` }),
          ],
          iteration,
        );

        expect(results.filter(result => result.status === 'rejected').map(result => codesOf(result.reason))).toEqual(
          [],
        );
        expect(await ctx.memory.getSignalRun({ threadId: thread.id })).toBeNull();
        expect(await claimedBy(thread, runId)).toEqual([]);
        expect((await rowsOf(thread)).filter(row => row.status === 'claimed')).toEqual([]);
      }
    },
    RACE_TIMEOUT,
  );

  it(
    'settles a thread deletion racing claims, a close, a cancel, sends, saves, updates and deletes, leaving no row of the thread',
    async () => {
      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const { thread, runId, claimed, pending, all } = await threadWithSignals();

        const results = await startShifted<unknown>(
          [
            ...[ctx.memory, ctx.peer].map(
              store => () => store.enqueuePendingSignal({ message: signalFor(thread), toRunId: runId }),
            ),
            () => claim(thread, runId),
            () => ctx.peer.closeSignalRun({ threadId: thread.id, runId, consumedIds: [claimed[0]!.id] }),
            () => ctx.memory.cancelPendingSignals({ threadId: thread.id, ids: reversed(ids(all)) }),
            () => ctx.peer.saveMessages({ messages: reversed([claimed[1]!, claimed[2]!, pending[0]!, pending[1]!]) }),
            () =>
              ctx.peer.updateMessages({
                messages: reversed(all).map(message => ({ id: message.id, content: { metadata: { updated: true } } })),
              }),
            () => ctx.memory.deleteMessages(reversed([claimed[3]!.id, pending[1]!.id, pending[2]!.id])),
            () => ctx.peer.deleteThread({ threadId: thread.id }),
          ],
          iteration,
        );

        // A save that finds the thread already deleted is refused; nothing else may fail. A send
        // after the close or the deletion is refused.
        for (const result of results) {
          if (result.status === 'fulfilled') {
            if (typeof result.value === 'string') {
              expect(['accepted', 'run-closed', 'thread-not-found']).toContain(result.value);
            }
            continue;
          }
          expect(codesOf(result.reason)).toEqual([]);
          expect(String(result.reason)).toContain(`Thread ${thread.id} not found`);
        }
        expect(await ctx.memory.getThreadById({ threadId: thread.id })).toBeNull();
        expect(await ctx.memory.getSignalRun({ threadId: thread.id })).toBeNull();
        expect(await rowsOf(thread)).toEqual([]);
      }
    },
    RACE_TIMEOUT,
  );
}

describe('Pending signals on connections that default to REPEATABLE READ', () => {
  const ctx = twoProcesses('rr', REPEATABLE_READ);
  const { newThread, startRun, signalFor, sendMany, claim, pendingIds, claimedBy } = helpers(ctx);

  beforeAll(async () => {
    const { rows } = await ctx.pool.query(`SHOW default_transaction_isolation`);
    expect(rows[0]!.default_transaction_isolation).toBe('repeatable read');
  });

  raceTests(ctx);

  it(
    'accepts concurrent sends to one run from both processes',
    async () => {
      for (let iteration = 0; iteration < 5; iteration++) {
        const thread = await newThread();
        const runId = await startRun(thread);
        const messages = Array.from({ length: 20 }, () => signalFor(thread));

        const results = await Promise.all(
          messages.map((message, index) =>
            (index % 2 === 0 ? ctx.memory : ctx.peer).enqueuePendingSignal({ message, toRunId: runId }),
          ),
        );

        expect(results).toEqual(messages.map(() => 'accepted'));
        expect(sorted(await pendingIds(thread))).toEqual(sorted(ids(messages)));
      }
    },
    RACE_TIMEOUT,
  );

  it(
    'settles concurrent claims, a close and a cancel as some serial order would',
    async () => {
      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const thread = await newThread();
        const runId = await startRun(thread);
        const sent = ids(await sendMany(thread, 6));
        const toCancel = [sent[5]!, sent[1]!];

        let cancelled: string[] = [];
        const results = await startShifted<unknown>(
          [
            () => claim(thread, runId),
            () => ctx.peer.closeSignalRun({ threadId: thread.id, runId, consumedIds: [] }),
            async () => {
              cancelled = await ctx.peer.cancelPendingSignals({ threadId: thread.id, ids: toCancel });
            },
            () => claim(thread, runId, [], ctx.peer),
          ],
          iteration,
        );

        // Whatever the order, the run ends closed with none of its rows left claimed, and every row
        // is either cancelled or pending again.
        expect(results.filter(result => result.status === 'rejected')).toEqual([]);
        expect(await ctx.memory.getSignalRun({ threadId: thread.id })).toBeNull();
        expect(await claimedBy(thread, runId)).toEqual([]);
        expect(sorted([...cancelled, ...(await pendingIds(thread))])).toEqual(sorted(sent));
        expect(toCancel).toEqual(expect.arrayContaining(cancelled));
      }
    },
    RACE_TIMEOUT,
  );

  it(
    'moves the rows of sends racing a thread transfer to the new resource',
    async () => {
      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const thread = await newThread();
        const runId = await startRun(thread);
        const seeded = ids(await sendMany(thread, 2));
        const resourceId = `resource-${randomUUID()}`;
        const messages = Array.from({ length: 6 }, () => signalFor(thread));
        const accepted: string[] = [];

        const results = await startShifted<unknown>(
          [
            ...messages.map((message, index) => async () => {
              const store = index % 2 === 0 ? ctx.memory : ctx.peer;
              const result = await store.enqueuePendingSignal({ message, toRunId: runId });
              expect(['accepted', 'thread-not-found']).toContain(result);
              if (result === 'accepted') accepted.push(message.id);
            }),
            () => ctx.peer.updateThreadResourceId({ threadId: thread.id, resourceId }),
          ],
          iteration,
        );

        // A send either lands before the transfer and moves with it, or finds the thread under
        // another resource and is refused.
        expect(results.filter(result => result.status === 'rejected')).toEqual([]);
        const pending = await ctx.memory.listPendingSignals({ threadId: thread.id });
        expect(sorted(ids(pending))).toEqual(sorted([...seeded, ...accepted]));
        expect(pending.filter(row => row.resourceId !== resourceId).map(row => row.id)).toEqual([]);
      }
    },
    RACE_TIMEOUT,
  );
});

describe('Pending signals across two processes', () => {
  const ctx = twoProcesses('races');
  const { newThread, startRun, send, sendMany, claim, pendingIds } = helpers(ctx);

  raceTests(ctx);

  it('keeps the signal run through saveThread and both kinds of updateThread', async () => {
    const thread = await newThread();
    const runId = await startRun(thread);

    await ctx.peer.saveThread({ thread: { ...thread, title: 'saved again', updatedAt: new Date() } });
    expect(await ctx.memory.getSignalRun({ threadId: thread.id })).toBe(runId);
    await ctx.peer.updateThread({ id: thread.id, title: 'title only' });
    expect(await ctx.memory.getSignalRun({ threadId: thread.id })).toBe(runId);
    await ctx.peer.updateThread({ id: thread.id, title: 'with metadata', metadata: { key: 'value' } });
    expect(await ctx.memory.getSignalRun({ threadId: thread.id })).toBe(runId);
  });

  it('applies the save transition row by row in one multi-row saveMessages', async () => {
    const thread = await newThread();
    const runId = await startRun(thread);
    const base = Date.now() - 100_000;
    const scope = { threadId: thread.id, resourceId: thread.resourceId };
    const normal = createSampleMessageV2({ ...scope, content: { content: 'before' }, createdAt: new Date(base) });
    await ctx.memory.saveMessages({ messages: [normal] });
    const claimed = await send(thread, { createdAt: new Date(base + 1) });
    await claim(thread, runId);
    const pending = await send(thread, { createdAt: new Date(base + 2) });
    const fresh = createSampleMessageV2({ ...scope, createdAt: new Date(base + 3) });
    const savedAt = base + 50_000;

    await ctx.peer.saveMessages({
      messages: [
        { ...pending, createdAt: new Date(savedAt) },
        { ...normal, content: { ...normal.content, content: 'after' }, createdAt: new Date(savedAt + 1) },
        { ...claimed, createdAt: new Date(savedAt + 2) },
        fresh,
      ],
    });

    const { rows } = await ctx.pool.query<{
      id: string;
      status: string | null;
      claimedBy: string | null;
      createdAt: string;
      createdAtZ: string;
    }>(
      `SELECT id, "signalStatus" AS status, "signalClaimedBy" AS "claimedBy",
         (extract(epoch FROM "createdAt") * 1000)::bigint::text AS "createdAt",
         (extract(epoch FROM "createdAtZ") * 1000)::bigint::text AS "createdAtZ"
       FROM ${ctx.messagesTable} WHERE thread_id = $1`,
      [thread.id],
    );
    const row = (id: string) => rows.find(candidate => candidate.id === id);
    const state = (status: string | null, claimant: string | null, at: number) => ({
      status,
      claimedBy: claimant,
      createdAt: String(at),
      createdAtZ: String(at),
    });
    expect(row(normal.id)).toMatchObject(state(null, null, base));
    expect(row(claimed.id)).toMatchObject(state(null, runId, savedAt + 2));
    expect(row(pending.id)).toMatchObject(state(null, null, savedAt));
    expect(row(fresh.id)).toMatchObject(state(null, null, base + 3));

    const { messages } = await ctx.memory.listMessages({ ...scope, perPage: false });
    expect(ids(messages)).toEqual([normal.id, fresh.id, pending.id, claimed.id]);
    expect(messages[0]!.content.content).toBe('after');
  });

  it('counts only visible messages in total and hasMore, for every count path', async () => {
    const resourceId = `resource-${randomUUID()}`;
    const thread = await newThread(resourceId);
    const sibling = await newThread(resourceId);
    const runId = await startRun(thread);
    const base = Date.now() - 100_000;
    const at = (offset: number) => new Date(base + offset);
    const message = (owner: StorageThreadType, offset: number) =>
      createSampleMessageV2({ threadId: owner.id, resourceId, createdAt: at(offset) });

    // Visible: three messages and a signal saved while claimed. Hidden: a pending and a claimed row.
    const visible = [message(thread, 0), message(thread, 2), message(thread, 4)];
    await ctx.memory.saveMessages({ messages: visible });
    const savedWhileClaimed = await send(thread, { createdAt: at(1) });
    await send(thread, { createdAt: at(3) });
    await claim(thread, runId);
    await ctx.memory.saveMessages({ messages: [{ ...savedWhileClaimed, createdAt: at(6) }] });
    await send(thread, { createdAt: at(5) });
    // The sibling has one visible message and one pending row.
    const siblingMessage = message(sibling, 7);
    await ctx.memory.saveMessages({ messages: [siblingMessage] });
    await send(sibling, { createdAt: at(8) });

    const threadVisible = [...ids(visible), savedWhileClaimed.id];
    const resourceVisible = [...threadVisible, siblingMessage.id];
    const fromOffset2 = { dateRange: { start: at(2) } };
    const toOffset4 = { dateRange: { end: at(4) } };
    const cases = [
      { args: { perPage: 2, page: 0 }, expected: threadVisible, page: 0 },
      { args: { perPage: 2, page: 1 }, expected: threadVisible, page: 1 },
      { args: { perPage: 2, page: 5 }, expected: threadVisible, page: 5 },
      { args: { perPage: false as const }, expected: threadVisible, page: 0 },
      { args: { perPage: 2, page: 0, resourceId }, expected: threadVisible, page: 0 },
      { args: { perPage: 2, page: 4, resourceId }, expected: threadVisible, page: 4 },
      { args: { perPage: 1, page: 0, filter: fromOffset2 }, expected: threadVisible.slice(1), page: 0 },
      { args: { perPage: 1, page: 9, filter: fromOffset2 }, expected: threadVisible.slice(1), page: 9 },
      { args: { perPage: 1, page: 0, filter: toOffset4 }, expected: ids(visible), page: 0 },
    ];
    for (const { args, expected, page } of cases) {
      const result = await ctx.peer.listMessages({ threadId: thread.id, ...args });
      const perPage = args.perPage === false ? expected.length : args.perPage;
      const label = JSON.stringify(args);
      expect({ label, total: result.total, hasMore: result.hasMore }).toEqual({
        label,
        total: expected.length,
        hasMore: args.perPage !== false && (page + 1) * perPage < expected.length,
      });
      expect({ label, ids: ids(result.messages) }).toEqual({
        label,
        ids: expected.slice(page * perPage, (page + 1) * perPage),
      });
    }

    const resourceCases = [
      { args: { perPage: 2, page: 0 }, expected: resourceVisible, page: 0 },
      { args: { perPage: 2, page: 6 }, expected: resourceVisible, page: 6 },
      { args: { perPage: false as const }, expected: resourceVisible, page: 0 },
      { args: { perPage: 2, page: 0, filter: fromOffset2 }, expected: resourceVisible.slice(1), page: 0 },
    ];
    for (const { args, expected, page } of resourceCases) {
      const result = await ctx.peer.listMessagesByResourceId({ resourceId, ...args });
      const perPage = args.perPage === false ? expected.length : args.perPage;
      const label = JSON.stringify(args);
      expect({ label, total: result.total, hasMore: result.hasMore }).toEqual({
        label,
        total: expected.length,
        hasMore: args.perPage !== false && (page + 1) * perPage < expected.length,
      });
      expect({ label, ids: ids(result.messages) }).toEqual({
        label,
        ids: expected.slice(page * perPage, (page + 1) * perPage),
      });
    }
  });

  it('orders rows with the same createdAt by id in code unit order', async () => {
    const thread = await newThread();
    const runId = await startRun(thread);
    const prefix = randomUUID();
    const createdAt = nextCreatedAt();
    // A linguistic collation would sort these as a, a1, a-1, b, Z.
    const order = ['Z', 'a', 'a-1', 'a1', 'b'].map(suffix => `${prefix}-${suffix}`);
    for (const id of reversed(order)) await send(thread, { id, createdAt });

    expect(await pendingIds(thread)).toEqual(order);
    expect(ids(await claim(thread, runId))).toEqual(order);
  });

  it('returns cancelled ids in the order asked, not the order the rows are stored or locked in', async () => {
    const thread = await newThread();
    const prefix = randomUUID();
    const inByteOrder = ['a', 'b', 'c', 'd'].map(suffix => `${prefix}-${suffix}`);
    for (const id of inByteOrder) await send(thread, { id });

    expect(await ctx.memory.cancelPendingSignals({ threadId: thread.id, ids: reversed(inByteOrder) })).toEqual(
      reversed(inByteOrder),
    );
  });

  it('takes id lists longer than the bind parameter limit in claim, close and cancel', async () => {
    // Postgres caps one statement at 65,535 bind parameters, so a placeholder per id would fail.
    const padding = Array.from({ length: 70_000 }, () => randomUUID());
    const thread = await newThread();
    const runId = await startRun(thread);
    const sent = ids(await sendMany(thread, 6));
    await claim(thread, runId);

    expect(ids(await claim(thread, runId, [...padding, sent[0]!, sent[1]!]))).toEqual(sent.slice(2));

    await ctx.peer.closeSignalRun({ threadId: thread.id, runId, consumedIds: [...padding, sent[0]!] });
    expect(await pendingIds(thread)).toEqual(sent.slice(1));

    const cancelled = await ctx.memory.cancelPendingSignals({
      threadId: thread.id,
      ids: [sent[3]!, ...padding, sent[2]!],
    });
    expect(cancelled).toEqual([sent[3], sent[2]]);
    expect(await pendingIds(thread)).toEqual([sent[1], sent[4], sent[5]]);
  });
});

describe('Pending-signal schema', () => {
  const admin = new Pool({ connectionString });

  afterAll(async () => {
    await admin.end();
  });

  async function onFreshSchema(name: string, fn: (schemaName: string, stores: PostgresStore[]) => Promise<void>) {
    const schemaName = newSchema(name);
    const stores: PostgresStore[] = [];
    try {
      await fn(schemaName, stores);
    } finally {
      await Promise.allSettled(stores.map(store => store.close()));
      await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  }

  const signalColumns = async (schemaName: string) =>
    (
      await admin.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
        `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_schema = $1 AND column_name LIKE 'signal%' ORDER BY table_name, column_name`,
        [schemaName],
      )
    ).rows;

  /** Indexes named after the schema and covering signal rows, in any schema. */
  const signalIndexes = async (schemaName: string) =>
    (
      await admin.query<{ schema: string; name: string; valid: boolean; definition: string }>(
        `SELECT n.nspname AS schema, c.relname AS name, i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS definition
         FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relname LIKE $1`,
        [`${schemaName}%signal%`],
      )
    ).rows;

  const expectedColumns = [
    { table_name: 'mastra_messages', column_name: 'signalClaimedBy', data_type: 'text', is_nullable: 'YES' },
    { table_name: 'mastra_messages', column_name: 'signalStatus', data_type: 'text', is_nullable: 'YES' },
    { table_name: 'mastra_threads', column_name: 'signalRunId', data_type: 'text', is_nullable: 'YES' },
  ];

  it('upgrades a database created before pending signals from two stores at once', async () => {
    await onFreshSchema('upgrade', async (schemaName, stores) => {
      const legacy = new PostgresStore({ id: 'signals-legacy', connectionString, schemaName });
      stores.push(legacy);
      const legacyMemory = await memoryOf(legacy);
      const thread = await legacyMemory.saveThread({ thread: createSampleThread() as StorageThreadType });
      const messages = [0, 1].map(offset =>
        createSampleMessageV2({
          threadId: thread.id,
          resourceId: thread.resourceId,
          createdAt: new Date(Date.now() - 10_000 + offset),
        }),
      );
      await legacyMemory.saveMessages({ messages });
      // The tables as a release without pending signals left them; dropping the columns drops the index.
      await admin.query(
        `ALTER TABLE "${schemaName}"."mastra_messages" DROP COLUMN "signalStatus", DROP COLUMN "signalClaimedBy"`,
      );
      await admin.query(`ALTER TABLE "${schemaName}"."mastra_threads" DROP COLUMN "signalRunId"`);
      expect(await signalColumns(schemaName)).toEqual([]);
      expect(await signalIndexes(schemaName)).toEqual([]);

      const upgraded = [0, 1].map(
        index => new PostgresStore({ id: `signals-upgraded-${index}`, connectionString, schemaName }),
      );
      stores.push(...upgraded);
      const [memory, peer] = await Promise.all(upgraded.map(memoryOf));

      expect(await signalColumns(schemaName)).toEqual(expectedColumns);
      const indexes = await signalIndexes(schemaName);
      expect(indexes).toMatchObject([{ schema: schemaName, valid: true }]);
      expect(indexes[0]!.definition).toContain(
        '(thread_id) WHERE (("signalStatus" IS NOT NULL) OR ("signalClaimedBy" IS NOT NULL))',
      );

      for (const store of [memory!, peer!]) {
        const listed = await store.listMessages({ threadId: thread.id, perPage: false });
        expect(ids(listed.messages)).toEqual(ids(messages));
      }
      const runId = newRun();
      await memory!.setSignalRun({ threadId: thread.id, runId });
      const signal = createSignal({ type: 'user', contents: 'after the upgrade' }).toDBMessage({
        threadId: thread.id,
        resourceId: thread.resourceId,
      });
      expect(await peer!.enqueuePendingSignal({ message: signal, toRunId: runId })).toBe('accepted');
      expect(ids(await memory!.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [] }))).toEqual([
        signal.id,
      ]);
    });
  });

  it('adds the columns but not the index when default indexes are skipped', async () => {
    await onFreshSchema('noidx', async (schemaName, stores) => {
      const store = new PostgresStore({
        id: 'signals-no-index',
        connectionString,
        schemaName,
        skipDefaultIndexes: true,
      });
      stores.push(store);
      await store.init();

      expect(await signalColumns(schemaName)).toEqual(expectedColumns);
      expect(await signalIndexes(schemaName)).toEqual([]);
    });
  });
});
