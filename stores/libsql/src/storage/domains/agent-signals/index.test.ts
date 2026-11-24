import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentSignalsTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import type { AgentSignalsStorage, StoredAgentSignalPayload } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LibSQLStore } from '../..';
import { AgentSignalsLibSQL } from './index';

const newThread = () => `thread-${randomUUID()}`;
const newRun = () => `run-${randomUUID()}`;

function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return {
    url: (name: string) => `file:${join(dir, name)}`,
    remove: () => rm(dir, { recursive: true, force: true, maxRetries: 5 }),
  };
}

async function signalsOf(store: LibSQLStore): Promise<AgentSignalsStorage> {
  await store.init();
  return (await store.getStore('agentSignals'))!;
}

// Two stores are two clients on one database file. Inside one process the store's per-file
// transaction gate serializes their transactions, so the suite's races order whole transactions
// from two clients. The suite clears the whole domain, so it gets a database file of its own.
describe('LibSQL agent signals on a database file', () => {
  const dir = tempDir('mastra-agent-signals-');
  const url = dir.url('signals.db');
  const stores = ['a', 'b'].map(id => new LibSQLStore({ id: `agent-signals-${id}`, url }));

  afterAll(async () => {
    await Promise.all(stores.map(store => store.close()));
    await dir.remove();
  });

  createAgentSignalsTests({ storage: stores[0]!, peerStorage: stores[1]! });

  describe('id lists longer than one batch', () => {
    const COUNT = 250;
    let signals: AgentSignalsStorage;

    beforeAll(async () => {
      signals = await signalsOf(stores[0]!);
    });

    async function enqueueMany(threadKey: string, runId: string) {
      const ids: string[] = [];
      for (let index = 0; index < COUNT; index++) {
        const id = randomUUID();
        await signals.enqueue({ id, threadKey, runId, scope: 'pending', signal: { id } });
        ids.push(id);
      }
      return ids;
    }

    it('closes a run with every listed consumed row deleted', async () => {
      const threadKey = newThread();
      const runId = newRun();
      const ids = await enqueueMany(threadKey, runId);
      await signals.claim({ threadKey, runId, scope: 'pending' });

      await signals.closeRun({ threadKey, runId, consumedIds: ids.slice(0, COUNT - 10) });

      expect((await signals.listPending({ threadKey, runId: null })).map(row => row.id)).toEqual(ids.slice(COUNT - 10));
    });

    it('cancels and deletes every listed row', async () => {
      const threadKey = newThread();
      const runId = newRun();
      const ids = await enqueueMany(threadKey, runId);

      const cancelled = await signals.cancel({ threadKey, ids: ids.slice(0, COUNT - 10) });
      expect([...cancelled].sort()).toEqual(ids.slice(0, COUNT - 10).sort());

      await signals.delete({ ids: ids.slice(COUNT - 10) });
      expect(await signals.listPending({ threadKey })).toEqual([]);
    });
  });

  it('returns a large payload with nested values and unicode exactly as enqueued', async () => {
    const signals = await signalsOf(stores[0]!);
    const threadKey = newThread();
    const runId = newRun();
    const id = randomUUID();
    const signal: StoredAgentSignalPayload = {
      id,
      type: 'user',
      contents: [
        { type: 'text', text: 'Grüße aus Zürich, 東京からこんにちは 👋🏽 🧪' },
        { type: 'text', text: 'x'.repeat(1024 * 1024) },
      ],
      attributes: { nested: { list: [1, 2.5, -3, true, false, null, { deep: ['a', { deeper: '🚀' }] }] } },
      empty: { object: {}, array: [] },
    };

    await signals.enqueue({ id, threadKey, runId, scope: 'pending', signal });

    expect((await signals.listPending({ threadKey }))[0]!.signal).toEqual(signal);
    expect((await signals.claim({ threadKey, runId, scope: 'pending' }))[0]!.signal).toEqual(signal);
  });
});

describe('LibSQL agent signals on an in-memory database', () => {
  const store = new LibSQLStore({ id: 'agent-signals-memory', url: ':memory:' });

  afterAll(async () => {
    await store.close();
  });

  createAgentSignalsTests({ storage: store });
});

describe('LibSQL agent signals after reopening the database', () => {
  const dir = tempDir('mastra-agent-signals-reopen-');

  afterAll(async () => {
    await dir.remove();
  });

  it('keeps rows, claims, order and closed runs', async () => {
    const url = dir.url('reopen.db');
    const threadKey = newThread();
    const openRun = newRun();
    const closedRun = newRun();

    const first = new LibSQLStore({ id: 'agent-signals-before', url });
    const before = await signalsOf(first);
    await before.enqueue({ id: 'claimed-1', threadKey, runId: openRun, scope: 'pending', signal: { n: 1 } });
    await before.enqueue({ id: 'claimed-2', threadKey, runId: openRun, scope: 'pending', signal: { n: 2 } });
    await before.claim({ threadKey, runId: openRun, scope: 'pending' });
    await before.enqueue({ id: 'left-over', threadKey, runId: closedRun, scope: 'pre-run', signal: { n: 3 } });
    await before.closeRun({ threadKey, runId: closedRun, consumedIds: [] });
    await first.close();

    const second = new LibSQLStore({ id: 'agent-signals-after', url });
    try {
      await second.init();
      await second.init();
      const after = (await second.getStore('agentSignals'))!;
      await after.init();

      expect((await after.listPending({ threadKey })).map(row => [row.id, row.runId, row.scope, row.signal])).toEqual([
        ['left-over', null, 'pre-run', { n: 3 }],
      ]);
      expect(await after.enqueue({ id: 'late', threadKey, runId: closedRun, scope: 'pending', signal: {} })).toBe(
        'run-closed',
      );

      await after.enqueue({ id: 'after-reopen', threadKey, runId: openRun, scope: 'pending', signal: { n: 4 } });
      const claimed = await after.claim({ threadKey, runId: openRun, scope: 'pending' });
      expect(claimed.map(row => [row.id, row.claimedBy])).toEqual([
        ['claimed-1', openRun],
        ['claimed-2', openRun],
        ['after-reopen', openRun],
      ]);
    } finally {
      await second.close();
    }
  });
});

describe('LibSQL agent signals sharing across processes', () => {
  const dir = tempDir('mastra-agent-signals-shared-');

  afterAll(async () => {
    await dir.remove();
  });

  it('is shared for a database file url', async () => {
    const store = new LibSQLStore({ id: 'agent-signals-file', url: dir.url('shared.db') });
    try {
      expect((await store.getStore('agentSignals'))!.sharedAcrossProcesses).toBe(true);
    } finally {
      await store.close();
    }
  });

  it('is not shared for an in-memory database url', async () => {
    const store = new LibSQLStore({ id: 'agent-signals-memory-url', url: ':memory:' });
    try {
      expect((await store.getStore('agentSignals'))!.sharedAcrossProcesses).toBe(false);
    } finally {
      await store.close();
    }
  });

  it('is not shared for a raw client on a database file or in memory', async () => {
    for (const url of [dir.url('raw.db'), ':memory:']) {
      const client = createClient({ url });
      try {
        const store = new LibSQLStore({ id: 'agent-signals-raw-client', client });
        expect((await store.getStore('agentSignals'))!.sharedAcrossProcesses).toBe(false);
        expect(new AgentSignalsLibSQL({ client }).sharedAcrossProcesses).toBe(false);
      } finally {
        client.close();
      }
    }
  });

  it('is not shared for an embedded replica', () => {
    // An embedded replica reads from a local file that syncs from a remote primary. Building one
    // needs that primary, so this checks the domain with the flag `LibSQLStore` sets for it, on a
    // file url that is shared without the flag.
    const url = dir.url('replica.db');
    expect(new AgentSignalsLibSQL({ url }).sharedAcrossProcesses).toBe(true);
    expect(new AgentSignalsLibSQL({ url, embeddedReplica: true }).sharedAcrossProcesses).toBe(false);
  });
});
