import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbClient, TxClient } from '../../client';
import { MemoryPG } from './index';

function makeMessage(id: string, threadId = 'thread-1', resourceId = 'resource-1') {
  return {
    id,
    threadId,
    resourceId,
    content: { text: `msg ${id}` },
    role: 'user' as const,
    type: 'v2' as const,
    createdAt: new Date('2024-01-01'),
  };
}

function makeThread(id = 'thread-1') {
  return { id, resourceId: 'resource-1', title: 'Test', metadata: {}, createdAt: new Date(), updatedAt: new Date() };
}

function makeMockClient(): { client: DbClient; tNone: ReturnType<typeof vi.fn> } {
  const tNone = vi.fn().mockResolvedValue(null);
  const txClient = {
    none: tNone,
    one: vi.fn(),
    oneOrNone: vi.fn(),
    any: vi.fn(),
    manyOrNone: vi.fn(),
    many: vi.fn(),
    query: vi.fn(),
    result: vi.fn(),
    tx: vi.fn(),
  } as unknown as TxClient;
  const client = {
    none: vi.fn().mockResolvedValue(null),
    one: vi.fn(),
    oneOrNone: vi.fn(),
    any: vi.fn(),
    manyOrNone: vi.fn(),
    many: vi.fn(),
    query: vi.fn(),
    result: vi.fn(),
    tx: vi.fn().mockImplementation(async (cb: (t: TxClient) => Promise<unknown>) => cb(txClient)),
  } as unknown as DbClient;
  return { client, tNone };
}

const PARAMS_PER_ROW = 8;
const CHUNK_SIZE = Math.floor(65535 / PARAMS_PER_ROW);

describe('saveMessages batch INSERT', () => {
  let memoryPG: MemoryPG;
  let tNone: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mock = makeMockClient();
    tNone = mock.tNone;
    memoryPG = new MemoryPG({ client: mock.client });
    vi.spyOn(memoryPG, 'getThreadById').mockResolvedValue(makeThread() as any);
  });

  it('inserts 10 messages in a single t.none call', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => makeMessage(`msg-${i}`));
    await memoryPG.saveMessages({ messages: messages as any });
    const insertCalls = tNone.mock.calls.filter(([sql]) => (sql as string).includes('INSERT INTO'));
    expect(insertCalls).toHaveLength(1);
    expect((insertCalls[0]![1] as unknown[]).length).toBe(10 * PARAMS_PER_ROW);
  });

  it('returns early without any INSERT when messages array is empty', async () => {
    await memoryPG.saveMessages({ messages: [] });
    expect(tNone).not.toHaveBeenCalled();
  });

  it('chunk size constant is 8191 (floor(65535 / 8))', () => {
    expect(CHUNK_SIZE).toBe(8191);
  });

  it('splits messages exceeding chunk size into two INSERT calls', async () => {
    const messages = Array.from({ length: CHUNK_SIZE + 1 }, (_, i) => makeMessage(`msg-${i}`));
    await memoryPG.saveMessages({ messages: messages as any });
    const insertCalls = tNone.mock.calls.filter(([sql]) => (sql as string).includes('INSERT INTO'));
    expect(insertCalls).toHaveLength(2);
    expect((insertCalls[0]![1] as unknown[]).length).toBe(CHUNK_SIZE * PARAMS_PER_ROW);
    expect((insertCalls[1]![1] as unknown[]).length).toBe(1 * PARAMS_PER_ROW);
  });

  it('INSERT includes ON CONFLICT DO UPDATE clause', async () => {
    await memoryPG.saveMessages({ messages: [makeMessage('id-1')] as any });
    const insertCalls = tNone.mock.calls.filter(([sql]) => (sql as string).includes('INSERT INTO'));
    expect(insertCalls[0]![0]).toContain('ON CONFLICT (id) DO UPDATE SET');
  });

  it('values are ordered: id, threadId, content, createdAt, createdAtZ, role, type, resourceId', async () => {
    const msg = makeMessage('id-1');
    await memoryPG.saveMessages({ messages: [msg] as any });
    const insertCalls = tNone.mock.calls.filter(([sql]) => (sql as string).includes('INSERT INTO'));
    const values = insertCalls[0]![1] as unknown[];
    expect(values[0]).toBe('id-1');
    expect(values[1]).toBe('thread-1');
    expect(values[2]).toBe(JSON.stringify(msg.content));
    expect(values[3]).toEqual(msg.createdAt);
    expect(values[4]).toEqual(msg.createdAt);
    expect(values[5]).toBe('user');
    expect(values[6]).toBe('v2');
    expect(values[7]).toBe('resource-1');
  });
});
