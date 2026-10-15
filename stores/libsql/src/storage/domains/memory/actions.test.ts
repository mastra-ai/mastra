import { createClient } from '@libsql/client';
import type { PersistableAction } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryLibSQL } from './index';

let seq = 0;
const id = () => `01J${String(++seq).padStart(23, '0')}`;

const text = (threadId: string, runId: string, value: string): PersistableAction => ({
  id: id(),
  threadId,
  resourceId: 'user-1',
  runId,
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  type: 'text',
  role: 'user',
  text: value,
  metadata: { source: 'test' },
});

describe('MemoryLibSQL actions', () => {
  let store: MemoryLibSQL;

  beforeEach(async () => {
    store = new MemoryLibSQL({ client: createClient({ url: 'file::memory:' }), maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
  });

  it('round-trips actions with all fields, ordered by id', async () => {
    const a = text('t1', 'r1', 'first');
    const b: PersistableAction = {
      id: id(),
      threadId: 't1',
      runId: 'r1',
      createdAt: new Date(),
      type: 'tool-result',
      toolCallId: 'c1',
      toolName: 'weather',
      output: { tempC: 21 },
    };
    await store.saveActions({ actions: [b, a].reverse() });

    const listed = await store.listActions({ threadId: 't1' });
    expect(listed).toEqual([a, b]);
    expect(listed[0]!.createdAt).toBeInstanceOf(Date);
    expect(listed[1]).not.toHaveProperty('resourceId');
  });

  it('filters by run, type, cursor, and limit, isolated by thread', async () => {
    const r1 = [text('t1', 'r1', '1'), text('t1', 'r1', '2')];
    const r2 = [text('t1', 'r2', '3')];
    const tool: PersistableAction = {
      id: id(),
      threadId: 't1',
      runId: 'r2',
      createdAt: new Date(),
      type: 'tool-call',
      toolCallId: 'c',
      toolName: 'w',
      input: {},
    };
    await store.saveActions({ actions: [...r1, ...r2, tool, text('t2', 'r1', 'other thread')] });

    expect((await store.listActions({ threadId: 't1', runId: 'r1' })).map(a => a.id)).toEqual(r1.map(a => a.id));
    expect((await store.listActions({ threadId: 't1', types: ['tool-call'] })).map(a => a.id)).toEqual([tool.id]);
    expect((await store.listActions({ threadId: 't1', after: r1[0]!.id, limit: 2 })).map(a => a.id)).toEqual([
      r1[1]!.id,
      r2[0]!.id,
    ]);
    expect(await store.listActions({ threadId: 't1' })).toHaveLength(4);
  });

  it('rejects duplicate ids and keeps the original', async () => {
    const a = text('t1', 'r1', 'original');
    await store.saveActions({ actions: [a] });
    await expect(store.saveActions({ actions: [{ ...a, text: 'overwrite' } as PersistableAction] })).rejects.toThrow();
    expect(await store.listActions({ threadId: 't1' })).toEqual([a]);
  });

  it('never stores transient actions', async () => {
    const a = text('t1', 'r1', 'kept');
    const delta = { ...a, id: id(), type: 'text-delta', transient: true, contentId: 'x', delta: 'd' };
    await store.saveActions({ actions: [a, delta as unknown as PersistableAction] });
    expect(await store.listActions({ threadId: 't1' })).toEqual([a]);
  });
});
