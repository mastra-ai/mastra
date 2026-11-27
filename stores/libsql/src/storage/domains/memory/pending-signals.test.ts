import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createChildProcessMemoryStorage,
  createSampleMessageV2,
  createSampleThread,
} from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { createSignal } from '@mastra/core/agent';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createMemoryTest } from '../../../../../_test-utils/src/domains/memory';
import { createPendingSignalsTest } from '../../../../../_test-utils/src/domains/memory/pending-signals';
import { LibSQLStore } from '../../index';
import { MemoryLibSQL } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDbUrl(fileName = 'mastra.db'): string {
  const dir = mkdtempSync(join(tmpdir(), 'libsql-pending-signals-'));
  dirs.push(dir);
  return `file:${join(dir, fileName)}`;
}

// The memory suite on a file database, with the conformance races split over a second store on
// the same file in this process. It checks that calls alternating between two connections, each
// with its own write queue, see each other's rows and signal run, and a peer makes the suite fail
// if pending signals are not supported. The local driver runs a batch synchronously, so batches
// from one process never overlap in SQLite: this run does not test SQLite's write lock.
describe('LibSQL memory suite on a file database, with a second store in this process', () => {
  const url = tempDbUrl();
  const storage = new LibSQLStore({ id: 'pending-signals-file', url });
  const peerStorage = new LibSQLStore({ id: 'pending-signals-file-peer', url });
  beforeAll(() => storage.init());
  afterAll(async () => {
    await peerStorage.close();
    await storage.close();
  });
  createMemoryTest({ storage, peerStorage });
});

// The conformance block again, with the peer's calls served by a child process on the same file.
// Its transactions run at the same time as this process's, so the races test that each check and
// its writes are serialized by SQLite's write lock.
describe('LibSQL pending signals with a second process on the same file', () => {
  const url = tempDbUrl();
  const storage = new LibSQLStore({ id: 'pending-signals-cross-process', url });
  let child: Awaited<ReturnType<typeof createChildProcessMemoryStorage>> | undefined;
  // `createPendingSignalsTest` reads the peer's memory domain through `init()` and `getStore()`.
  const peerStorage = {
    init: async () => {
      child ??= await createChildProcessMemoryStorage({
        modulePath: fileURLToPath(new URL('./index.ts', import.meta.url)),
        exportName: 'MemoryLibSQL',
        options: { url },
      });
    },
    getStore: async () => child!.storage,
  } as unknown as MastraStorage;
  afterAll(async () => {
    await child?.close();
    await storage.close();
  });
  createPendingSignalsTest({ storage, peerStorage });
});

async function openMemory(url: string): Promise<{ store: LibSQLStore; memory: MemoryStorage }> {
  const store = new LibSQLStore({ id: `store-${randomUUID()}`, url });
  await store.init();
  return { store, memory: (await store.getStore('memory'))! };
}

let clock = Date.now() - 600_000;
function signalFor(thread: StorageThreadType, id?: string): MastraDBMessage {
  return createSignal({ type: 'user', id, contents: 'a signal', createdAt: new Date(++clock) }).toDBMessage({
    threadId: thread.id,
    resourceId: thread.resourceId,
  });
}

async function newThread(memory: MemoryStorage): Promise<StorageThreadType> {
  return memory.saveThread({ thread: createSampleThread() as StorageThreadType });
}

type Statement = { sql: string; args: unknown[] };

/**
 * A real client on `url` that records the statements sent through `execute` and `batch`, and
 * awaits `afterStatement` once each of them has run (for a batch, after the whole batch).
 */
function recordingClient(url: string, afterStatement?: (statement: Statement) => Promise<void>) {
  const statements: Statement[] = [];
  const toStatement = (statement: string | { sql: string; args?: unknown }): Statement =>
    typeof statement === 'string'
      ? { sql: statement, args: [] }
      : { sql: statement.sql, args: (statement.args as unknown[] | undefined) ?? [] };
  const after = async (sent: Statement[]) => {
    for (const statement of sent) await afterStatement?.(statement);
  };
  const client = new Proxy(createClient({ url }), {
    get(target, prop) {
      if (prop === 'execute') {
        return async (statement: Parameters<Client['execute']>[0]) => {
          const recorded = toStatement(statement as never);
          statements.push(recorded);
          const result = await target.execute(statement as never);
          await after([recorded]);
          return result;
        };
      }
      if (prop === 'batch') {
        return async (batch: Parameters<Client['batch']>[0], mode?: Parameters<Client['batch']>[1]) => {
          const recorded = batch.map(statement => toStatement(statement as never));
          statements.push(...recorded);
          const result = await target.batch(batch, mode);
          await after(recorded);
          return result;
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { client, statements };
}

/** The stored thread and resource of each row; reads by thread or resource never return a queued row. */
async function signalColumns(url: string, ids: string[]) {
  const client = createClient({ url });
  try {
    const result = await client.execute({
      sql: `SELECT id, thread_id, "resourceId" FROM mastra_messages WHERE id IN (SELECT value FROM json_each(?))`,
      args: [JSON.stringify(ids)],
    });
    return Object.fromEntries(
      result.rows.map(row => [row.id as string, { threadId: row.thread_id, resourceId: row.resourceId }]),
    );
  } finally {
    client.close();
  }
}

const pendingThreadOf = (thread: { id: string }) => `mastra-queue:pending:${thread.id}`;
const takenThreadOf = (thread: { id: string }) => `mastra-queue:taken:${thread.id}`;

describe('LibSQL pending signals', () => {
  describe('schema', () => {
    /** Tables as they were before pending signals, holding a thread and two messages. */
    async function createDatabaseWithoutSignalColumns(url: string) {
      const thread = { id: `thread-${randomUUID()}`, resourceId: `resource-${randomUUID()}` };
      const messageIds = [`msg-${randomUUID()}`, `msg-${randomUUID()}`];
      const client = createClient({ url });
      try {
        await client.batch(
          [
            `CREATE TABLE mastra_threads (id TEXT NOT NULL PRIMARY KEY, "resourceId" TEXT NOT NULL, title TEXT NOT NULL, metadata TEXT, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL)`,
            `CREATE TABLE mastra_messages (id TEXT NOT NULL PRIMARY KEY, thread_id TEXT NOT NULL, content TEXT NOT NULL, role TEXT NOT NULL, type TEXT NOT NULL, "createdAt" TEXT NOT NULL, "resourceId" TEXT)`,
            {
              sql: `INSERT INTO mastra_threads VALUES (?, ?, 'Old thread', jsonb('{}'), ?, ?)`,
              args: [thread.id, thread.resourceId, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'],
            },
            ...messageIds.map((id, index) => ({
              sql: `INSERT INTO mastra_messages VALUES (?, ?, ?, 'user', 'v2', ?, ?)`,
              args: [
                id,
                thread.id,
                JSON.stringify({ format: 2, parts: [{ type: 'text', text: `old ${index}` }] }),
                `2025-01-01T00:00:0${index + 1}.000Z`,
                thread.resourceId,
              ],
            })),
          ],
          'write',
        );
      } finally {
        client.close();
      }
      return { thread, messageIds };
    }

    async function columnsOf(url: string, table: string) {
      const client = createClient({ url });
      try {
        const result = await client.execute(`PRAGMA table_info("${table}")`);
        return result.rows.map(row => row.name as string);
      } finally {
        client.close();
      }
    }

    it('upgrades an existing database: old messages stay visible and old threads have no signal run', async () => {
      const url = tempDbUrl();
      const { thread, messageIds } = await createDatabaseWithoutSignalColumns(url);

      const { store, memory } = await openMemory(url);
      try {
        const messageColumns = await columnsOf(url, 'mastra_messages');
        expect(messageColumns.filter(name => name.startsWith('signal'))).toEqual([]);
        expect(await columnsOf(url, 'mastra_threads')).toContain('signalRunId');

        const listed = await memory.listMessages({
          threadId: thread.id,
          resourceId: thread.resourceId,
          perPage: false,
        });
        expect(listed.messages.map(message => message.id)).toEqual(messageIds);
        expect(listed.total).toBe(2);
        expect(await memory.getSignalRun({ threadId: thread.id })).toBeNull();

        const runId = `run-${randomUUID()}`;
        await memory.setSignalRun({ threadId: thread.id, runId });
        const signal = signalFor(thread as StorageThreadType);
        expect(await memory.enqueuePendingSignal({ message: signal, toRunId: runId })).toBe('accepted');
        expect(
          (await memory.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [] })).map(m => m.id),
        ).toEqual([signal.id]);
      } finally {
        await store.close();
      }
    });

    it('runs init repeatedly and concurrently from two instances on an existing database', async () => {
      const url = tempDbUrl();
      const { thread, messageIds } = await createDatabaseWithoutSignalColumns(url);
      const clients = [createClient({ url }), createClient({ url })];
      try {
        const [first, second] = clients.map(client => new MemoryLibSQL({ client }));

        await Promise.all([first!.init(), second!.init()]);
        await first!.init();
        await second!.init();

        const columns = await columnsOf(url, 'mastra_messages');
        expect(columns.filter(name => name.startsWith('signal'))).toEqual([]);
        expect((await columnsOf(url, 'mastra_threads')).filter(name => name === 'signalRunId')).toEqual([
          'signalRunId',
        ]);
        const listed = await second!.listMessages({ threadId: thread.id, perPage: false });
        expect(listed.messages.map(message => message.id)).toEqual(messageIds);
      } finally {
        for (const client of clients) client.close();
      }
    });

    // A store created with `disableInit` serves message reads and saves before its migration ran.
    it('reads, saves, updates and deletes messages on a database without the signal columns', async () => {
      const url = tempDbUrl();
      const { thread, messageIds } = await createDatabaseWithoutSignalColumns(url);
      const client = createClient({ url });
      try {
        const memory = new MemoryLibSQL({ client });
        const scope = { threadId: thread.id, resourceId: thread.resourceId };
        const added = createSampleMessageV2({ ...scope, createdAt: new Date('2025-01-01T00:00:03.000Z') });
        await memory.saveMessages({ messages: [added] });
        const [first] = (await memory.listMessagesById({ messageIds: [messageIds[0]!] })).messages;
        await memory.saveMessages({ messages: [{ ...first!, content: { ...first!.content, content: 'resaved' } }] });
        await memory.updateMessages({
          messages: [{ id: messageIds[1]!, content: { content: 'updated' } as MastraDBMessage['content'] }],
        });

        const listed = await memory.listMessages({ ...scope, perPage: false });
        expect(listed.messages.map(message => message.id)).toEqual([...messageIds, added.id]);
        expect(listed.total).toBe(3);
        expect(listed.messages.map(message => message.content.content)).toEqual([
          'resaved',
          'updated',
          added.content.content,
        ]);
        const byResource = await memory.listMessagesByResourceId({ resourceId: thread.resourceId, perPage: 1 });
        expect(byResource.total).toBe(3);
        const window = await memory.listMessages({
          threadId: thread.id,
          perPage: 0,
          include: [{ id: messageIds[1]!, withPreviousMessages: 1, withNextMessages: 1 }],
        });
        expect(window.messages.map(message => message.id)).toEqual([...messageIds, added.id]);

        await memory.deleteMessages([added.id]);
        expect((await memory.listMessages({ ...scope, perPage: false })).total).toBe(2);
        expect(await columnsOf(url, 'mastra_threads')).not.toContain('signalRunId');
      } finally {
        client.close();
      }
    });

    // The statements carry no ORDER BY (the store sorts the rows), so only index use is checked.
    it('serves the statements claim, close, cancel and list send from an index', async () => {
      const url = tempDbUrl();
      const { client, statements } = recordingClient(url);
      const store = new LibSQLStore({ id: 'plans', client });
      try {
        await store.init();
        const memory = (await store.getStore('memory'))!;
        const thread = await newThread(memory);
        const runId = `run-${randomUUID()}`;
        await memory.setSignalRun({ threadId: thread.id, runId });
        const sent = [signalFor(thread), signalFor(thread)];
        for (const message of sent) await memory.enqueuePendingSignal({ message });

        statements.length = 0;
        await memory.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [sent[0]!.id] });
        await memory.closeSignalRun({ threadId: thread.id, runId, consumedIds: [sent[0]!.id] });
        await memory.cancelPendingSignals({ threadId: thread.id, ids: [sent[1]!.id] });
        await memory.listPendingSignals({ threadId: thread.id });

        const onMessages = statements.filter(({ sql }) =>
          /^\s*(SELECT|UPDATE|DELETE)[\s\S]*"mastra_messages"/.test(sql),
        );
        // Pending and taken rows are found through either thread index under their own thread id.
        const byThread =
          /SEARCH mastra_messages USING (COVERING )?INDEX idx_messages_thread_(resource_)?created_at \(thread_id=\?/;
        // Claim: take and read. Close: delete and give back. Cancel: select and delete. List: select.
        expect(onMessages).toHaveLength(7);
        for (const { sql, args } of onMessages) {
          const plan = await client.execute({ sql: `EXPLAIN QUERY PLAN ${sql}`, args: args as never });
          const details = plan.rows.map(row => String(row.detail)).join('\n');
          expect({ sql, details }).toEqual({ sql, details: expect.stringMatching(byThread) });
        }
      } finally {
        await store.close();
      }
    });
  });

  describe('existing methods', () => {
    it('keeps the signal run when saveThread replaces the thread row and when updateThread changes it', async () => {
      const url = tempDbUrl();
      const { store, memory } = await openMemory(url);
      try {
        const thread = await memory.saveThread({
          thread: { ...(createSampleThread() as StorageThreadType), metadata: { kept: false } },
        });
        const runId = `run-${randomUUID()}`;
        await memory.setSignalRun({ threadId: thread.id, runId });

        // saveThread still replaces every thread column it owns: an omitted metadata is cleared.
        const createdAt = new Date('2025-06-01T00:00:00.000Z');
        const updatedAt = new Date('2025-06-02T00:00:00.000Z');
        const resourceId = `resource-${randomUUID()}`;
        const { metadata: _metadata, ...withoutMetadata } = thread;
        await memory.saveThread({
          thread: { ...withoutMetadata, resourceId, title: 'renamed', createdAt, updatedAt } as StorageThreadType,
        });
        const saved = await memory.getThreadById({ threadId: thread.id });
        expect(saved).toMatchObject({ resourceId, title: 'renamed', createdAt, updatedAt });
        expect(saved?.metadata ?? null).toBeNull();
        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(runId);

        await memory.updateThread({ id: thread.id, title: 'updated', metadata: { kept: true } });
        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(runId);
      } finally {
        await store.close();
      }
    });

    it('saves a thread whose table has columns added under names that are not plain identifiers', async () => {
      const url = tempDbUrl();
      await (await openMemory(url)).store.close();
      const client = createClient({ url });
      try {
        await client.execute(`ALTER TABLE mastra_threads ADD COLUMN "display-color" TEXT`);
        // The column name `a"b`, with a double quote in it.
        await client.execute(`ALTER TABLE mastra_threads ADD COLUMN "a""b" TEXT`);
      } finally {
        client.close();
      }

      const { store, memory } = await openMemory(url);
      try {
        const thread = createSampleThread() as StorageThreadType;
        await expect(memory.saveThread({ thread })).resolves.toMatchObject({ id: thread.id });
        const runId = `run-${randomUUID()}`;
        await memory.setSignalRun({ threadId: thread.id, runId });

        await expect(memory.saveThread({ thread: { ...thread, title: 'renamed' } })).resolves.toMatchObject({
          title: 'renamed',
        });
        expect(await memory.getThreadById({ threadId: thread.id })).toMatchObject({ title: 'renamed' });
        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(runId);
      } finally {
        await store.close();
      }
    });

    it('applies the save transition per row in one multi-row saveMessages', async () => {
      const url = tempDbUrl();
      const { store, memory } = await openMemory(url);
      try {
        const thread = await newThread(memory);
        const scope = { threadId: thread.id, resourceId: thread.resourceId };
        const runId = `run-${randomUUID()}`;
        await memory.setSignalRun({ threadId: thread.id, runId });

        const claimed = signalFor(thread);
        await memory.enqueuePendingSignal({ message: claimed });
        await memory.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [] });
        const pending = signalFor(thread);
        await memory.enqueuePendingSignal({ message: pending });
        // Until the save, the rows sit under the thread's taken and pending ids, without a resource.
        expect(await signalColumns(url, [claimed.id, pending.id])).toEqual({
          [claimed.id]: { threadId: takenThreadOf(thread), resourceId: null },
          [pending.id]: { threadId: pendingThreadOf(thread), resourceId: null },
        });
        const originalAt = new Date('2025-01-01T00:00:00.000Z');
        const existing = createSampleMessageV2({ ...scope, content: { content: 'before' }, createdAt: originalAt });
        await memory.saveMessages({ messages: [existing] });
        const fresh = createSampleMessageV2({ ...scope, createdAt: new Date('2025-01-01T00:00:05.000Z') });

        const savedAt = (offset: number) => new Date(Date.parse('2025-01-01T00:00:01.000Z') + offset);
        await memory.saveMessages({
          messages: [
            { ...pending, createdAt: savedAt(0) },
            { ...existing, createdAt: savedAt(1), content: { ...existing.content, content: 'after' } },
            { ...claimed, createdAt: savedAt(2) },
            fresh,
          ],
        });

        const listed = (await memory.listMessages({ ...scope, perPage: false })).messages;
        expect(listed.map(message => [message.id, new Date(message.createdAt).toISOString()])).toEqual([
          [existing.id, originalAt.toISOString()],
          [pending.id, savedAt(0).toISOString()],
          [claimed.id, savedAt(2).toISOString()],
          [fresh.id, fresh.createdAt.toISOString()],
        ]);
        expect(listed[0]!.content.content).toBe('after');
        const inThread = { threadId: thread.id, resourceId: thread.resourceId };
        expect(await signalColumns(url, [pending.id, existing.id, claimed.id, fresh.id])).toEqual({
          [pending.id]: inThread,
          [existing.id]: inThread,
          [claimed.id]: inThread,
          [fresh.id]: inThread,
        });
        expect(await memory.listPendingSignals({ threadId: thread.id })).toEqual([]);
        expect(await memory.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [] })).toEqual([]);
      } finally {
        await store.close();
      }
    });

    it('counts only messages, for every filter, with pending and taken rows that match it', async () => {
      const url = tempDbUrl();
      const { store, memory } = await openMemory(url);
      try {
        const thread = await newThread(memory);
        const scope = { threadId: thread.id, resourceId: thread.resourceId };
        const runId = `run-${randomUUID()}`;
        await memory.setSignalRun({ threadId: thread.id, runId });
        const base = Date.parse('2025-03-01T00:00:00.000Z');
        const at = (seconds: number) => new Date(base + seconds * 1000);
        const tagged = { metadata: { tag: 'a' } };

        // Messages at 0..4 s, tagged at 0, 2 and 4 s.
        const messages = [0, 1, 2, 3, 4].map(second =>
          createSampleMessageV2({ ...scope, createdAt: at(second), content: second % 2 === 0 ? tagged : {} }),
        );
        await memory.saveMessages({ messages });
        // Queued rows that match every filter below: one taken at 1.5 s, one pending at 3.5 s.
        const claimed = createSampleMessageV2({ ...scope, createdAt: at(1.5), content: tagged });
        await memory.enqueuePendingSignal({ message: claimed });
        // A row taken and then saved is a message, at 2.5 s.
        const saved = createSampleMessageV2({ ...scope, createdAt: at(2.5), content: tagged });
        await memory.enqueuePendingSignal({ message: saved });
        await memory.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [] });
        await memory.saveMessages({ messages: [saved] });
        await memory.enqueuePendingSignal({
          message: createSampleMessageV2({ ...scope, createdAt: at(3.5), content: tagged }),
        });

        const dateRange = { start: at(1), end: at(3) };
        const metadata = { tag: 'a' };
        const cases = [
          { filter: undefined, total: 6 },
          { filter: { dateRange }, total: 4 },
          { filter: { metadata }, total: 4 },
          { filter: { dateRange, metadata }, total: 2 },
        ];
        for (const { filter, total } of cases) {
          for (const resourceId of [undefined, thread.resourceId]) {
            const byThread = await memory.listMessages({ threadId: thread.id, resourceId, filter, perPage: 2 });
            expect({ filter, resourceId, total: byThread.total, hasMore: byThread.hasMore }).toEqual({
              filter,
              resourceId,
              total,
              hasMore: total > 2,
            });
          }
          const byResource = await memory.listMessagesByResourceId({
            resourceId: thread.resourceId,
            filter,
            perPage: 2,
          });
          expect({ filter, total: byResource.total, hasMore: byResource.hasMore }).toEqual({
            filter,
            total,
            hasMore: total > 2,
          });
          const all = await memory.listMessages({ threadId: thread.id, filter, perPage: false });
          expect({ filter, total: all.total, listed: all.messages.length }).toEqual({ filter, total, listed: total });
        }
      } finally {
        await store.close();
      }
    });

    it('returns every message with perPage false when a signal is saved with an older createdAt between the count and the read', async () => {
      const url = tempDbUrl();
      const peer = await openMemory(url);
      let toSave: MastraDBMessage | undefined;
      // Right after the count statement, another connection saves the claimed signal as a message.
      const { client } = recordingClient(url, async ({ sql }) => {
        if (!toSave || !sql.includes('SELECT COUNT(*)')) return;
        const message = toSave;
        toSave = undefined;
        await peer.memory.saveMessages({ messages: [message] });
      });
      const store = new LibSQLStore({ id: 'list-all-during-save', client });
      await store.init();
      const memory = (await store.getStore('memory'))!;
      try {
        for (const byResource of [false, true]) {
          const thread = await newThread(memory);
          const runId = `run-${randomUUID()}`;
          await memory.setSignalRun({ threadId: thread.id, runId });
          const message = createSampleMessageV2({ threadId: thread.id, resourceId: thread.resourceId });
          await memory.saveMessages({ messages: [message] });
          const signal = signalFor(thread);
          await memory.enqueuePendingSignal({ message: signal, toRunId: runId });
          await memory.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [] });
          toSave = { ...signal, createdAt: new Date(message.createdAt.getTime() - 60_000) };

          const listed = byResource
            ? await memory.listMessagesByResourceId({ resourceId: thread.resourceId, perPage: false })
            : await memory.listMessages({ threadId: thread.id, perPage: false });
          expect(toSave).toBeUndefined();
          expect({ byResource, ids: listed.messages.map(row => row.id), hasMore: listed.hasMore }).toEqual({
            byResource,
            ids: [signal.id, message.id],
            hasMore: false,
          });
        }
      } finally {
        await store.close();
        await peer.store.close();
      }
    });

    it('deletes a thread and its rows in one write, so a run send either lands before and is deleted or finds no thread', async () => {
      const url = tempDbUrl();
      const peer = await openMemory(url);
      let sent: { id: string; result: string } | undefined;
      // Sends from another connection right after the statement that deletes the thread's messages.
      const { client } = recordingClient(url, async ({ sql }) => {
        if (sent || !/^DELETE FROM mastra_messages WHERE thread_id IN \(\?, \?, \?\)$/.test(sql)) return;
        const message = signalFor(thread);
        sent = { id: message.id, result: await peer.memory.enqueuePendingSignal({ message, toRunId: runId }) };
      });
      const store = new LibSQLStore({ id: 'delete-thread', client });
      await store.init();
      const memory = (await store.getStore('memory'))!;
      const thread = await newThread(memory);
      const runId = `run-${randomUUID()}`;
      await memory.setSignalRun({ threadId: thread.id, runId });
      try {
        await memory.deleteThread({ threadId: thread.id });

        expect(sent?.result).toBe('thread-not-found');
        expect(await signalColumns(url, [sent!.id])).toEqual({});
      } finally {
        await store.close();
        await peer.store.close();
      }
    });

    it('fails a copy instead of cloning a message that became a pending signal after the copy read the thread', async () => {
      const url = tempDbUrl();
      const peer = await openMemory(url);
      let replaced = false;
      // Between the copy's read of the source ids and its write, the message is replaced by a pending signal.
      const { client } = recordingClient(url, async ({ sql }) => {
        if (replaced || !sql.startsWith('SELECT id, "createdAt"')) return;
        replaced = true;
        await peer.memory.deleteMessages([message.id]);
        await peer.memory.enqueuePendingSignal({ message: { ...message, role: 'signal' as never } });
      });
      const store = new LibSQLStore({ id: 'copy-thread', client });
      await store.init();
      const memory = (await store.getStore('memory'))!;
      const thread = await newThread(memory);
      const message = createSampleMessageV2({ threadId: thread.id, resourceId: thread.resourceId });
      await memory.saveMessages({ messages: [message] });
      const newThreadId = `thread-${randomUUID()}`;
      try {
        await expect(memory.copyThread({ sourceThreadId: thread.id, newThreadId })).rejects.toThrow();

        expect(replaced).toBe(true);
        expect(await memory.getThreadById({ threadId: newThreadId })).toBeNull();
        expect((await memory.listPendingSignals({ threadId: thread.id })).map(row => row.id)).toEqual([message.id]);
      } finally {
        await store.close();
        await peer.store.close();
      }
    });
  });

  describe('pendingSignalsSharedAcrossProcesses', () => {
    // The client opens an in-memory database when the decoded path of a `file:` url without an
    // authority is exactly `:memory:`. Any other path is a file other processes can open.
    const urls = () => [
      { url: tempDbUrl(), shared: true },
      { url: ':memory:', shared: false },
      { url: 'file::memory:', shared: false },
      { url: 'file::memory:?cache=shared', shared: false },
      { url: 'file:%3Amemory%3A', shared: false },
      { url: tempDbUrl('my%3Amemory%3A.db'), shared: true },
      { url: tempDbUrl(':memory:backup.db'), shared: true },
    ];

    it('is true for a file database and false for an in-memory one', async () => {
      const stores = urls().map(({ url, shared }) => ({
        url,
        shared,
        store: new LibSQLStore({ id: `shared-${randomUUID()}`, url }),
      }));
      try {
        const reported = await Promise.all(
          stores.map(async ({ url, store }) => ({
            url,
            shared: (await store.getStore('memory'))!.pendingSignalsSharedAcrossProcesses,
          })),
        );
        expect(reported).toEqual(stores.map(({ url, shared }) => ({ url, shared })));
      } finally {
        await Promise.all(stores.map(({ store }) => store.close()));
      }
    });

    it('counts a client passed in directly only when it is remote', async () => {
      const local = createClient({ url: tempDbUrl() });
      const remote = createClient({ url: 'http://127.0.0.1:1' });
      try {
        const localStore = new LibSQLStore({ id: 'local-client', client: local });
        const remoteStore = new LibSQLStore({ id: 'remote-client', client: remote });
        expect((await localStore.getStore('memory'))!.pendingSignalsSharedAcrossProcesses).toBe(false);
        expect((await remoteStore.getStore('memory'))!.pendingSignalsSharedAcrossProcesses).toBe(true);
      } finally {
        local.close();
        remote.close();
      }
    });

    // The domain has no close, so the clients it opens from a url stay open until the process exits.
    it('follows the url when the memory domain is built directly', () => {
      const cases = urls();
      expect(
        cases.map(({ url }) => ({ url, shared: new MemoryLibSQL({ url }).pendingSignalsSharedAcrossProcesses })),
      ).toEqual(cases);
      expect(
        new MemoryLibSQL({ url: tempDbUrl(), sharedAcrossProcesses: false }).pendingSignalsSharedAcrossProcesses,
      ).toBe(false);
    });

    it('counts a client passed to the memory domain directly only when it is remote', () => {
      const local = createClient({ url: tempDbUrl() });
      const remote = createClient({ url: 'http://127.0.0.1:1' });
      try {
        expect(new MemoryLibSQL({ client: local }).pendingSignalsSharedAcrossProcesses).toBe(false);
        expect(new MemoryLibSQL({ client: remote }).pendingSignalsSharedAcrossProcesses).toBe(true);
      } finally {
        local.close();
        remote.close();
      }
    });
  });

  it('claims, closes and cancels with tens of thousands of ids', async () => {
    const url = tempDbUrl();
    const { store, memory } = await openMemory(url);
    try {
      const thread = await newThread(memory);
      const runId = `run-${randomUUID()}`;
      await memory.setSignalRun({ threadId: thread.id, runId });
      const sent: string[] = [];
      for (let index = 0; index < 5; index++) {
        const message = signalFor(thread);
        await memory.enqueuePendingSignal({ message });
        sent.push(message.id);
      }
      // More ids than SQLite accepts as bind parameters in one statement.
      const unknownIds = Array.from({ length: 40_000 }, () => `msg-${randomUUID()}`);

      const claimed = await memory.claimPendingSignals({
        threadId: thread.id,
        runId,
        consumedIds: [...unknownIds, sent[0]!, sent[3]!],
      });
      expect(claimed.map(message => message.id)).toEqual([sent[1], sent[2], sent[4]]);

      await memory.closeSignalRun({ threadId: thread.id, runId, consumedIds: [...unknownIds, sent[0]!] });
      expect((await memory.listPendingSignals({ threadId: thread.id })).map(message => message.id)).toEqual(
        sent.slice(1),
      );
      // Rows given back are under the pending id again, and the consumed row is gone.
      expect(await signalColumns(url, sent)).toEqual(
        Object.fromEntries(sent.slice(1).map(id => [id, { threadId: pendingThreadOf(thread), resourceId: null }])),
      );

      // Neither the send order nor its reverse.
      expect(
        await memory.cancelPendingSignals({ threadId: thread.id, ids: [...unknownIds, sent[3]!, sent[1]!, sent[4]!] }),
      ).toEqual([sent[3], sent[1], sent[4]]);
      expect((await memory.listPendingSignals({ threadId: thread.id })).map(message => message.id)).toEqual([sent[2]]);
    } finally {
      await store.close();
    }
  });

  it('orders rows with the same createdAt by id in code unit order, not by UTF-8 bytes', async () => {
    const url = tempDbUrl();
    const { store, memory } = await openMemory(url);
    try {
      const thread = await newThread(memory);
      const runId = `run-${randomUUID()}`;
      await memory.setSignalRun({ threadId: thread.id, runId });
      const createdAt = new Date('2025-04-01T00:00:00.000Z');
      // U+1F600 is the surrogate pair D83D DE00, below U+FFFD in code units and above it in UTF-8 bytes.
      const prefix = `signal-${randomUUID()}-`;
      const sorted = [`${prefix}\u{1F600}`, `${prefix}\uFFFD`];
      for (const id of [...sorted].reverse()) {
        await memory.enqueuePendingSignal({ message: { ...signalFor(thread, id), createdAt } });
      }

      expect((await memory.listPendingSignals({ threadId: thread.id })).map(message => message.id)).toEqual(sorted);
      expect(
        (await memory.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [] })).map(message => message.id),
      ).toEqual(sorted);
    } finally {
      await store.close();
    }
  });

  it('keeps rows, claims and the signal run when the database is closed and reopened', async () => {
    const url = tempDbUrl();
    const runId = `run-${randomUUID()}`;
    const first = await openMemory(url);
    const thread = await newThread(first.memory);
    await first.memory.setSignalRun({ threadId: thread.id, runId });
    const claimed = signalFor(thread);
    const saved = signalFor(thread);
    for (const message of [claimed, saved]) await first.memory.enqueuePendingSignal({ message });
    await first.memory.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [] });
    await first.memory.saveMessages({ messages: [saved] });
    const pending = signalFor(thread);
    await first.memory.enqueuePendingSignal({ message: pending, toRunId: runId });
    await first.store.close();

    const second = await openMemory(url);
    try {
      expect(await second.memory.getSignalRun({ threadId: thread.id })).toBe(runId);
      expect((await second.memory.listPendingSignals({ threadId: thread.id })).map(message => message.id)).toEqual([
        pending.id,
      ]);
      expect(
        (await second.memory.listMessages({ threadId: thread.id, perPage: false })).messages.map(message => message.id),
      ).toEqual([saved.id]);
      expect(
        (await second.memory.claimPendingSignals({ threadId: thread.id, runId, consumedIds: [] })).map(
          message => message.id,
        ),
      ).toEqual([claimed.id, pending.id]);
    } finally {
      await second.store.close();
    }
  });
});
