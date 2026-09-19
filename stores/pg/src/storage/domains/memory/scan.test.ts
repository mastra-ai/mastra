import { randomUUID } from 'node:crypto';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { connectionString } from '../../test-utils';
import { scanById } from './scan';
import type { MemoryScanPage } from './scan';
import { MemoryPG } from './index';

const schemaName = `mscan_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const date = new Date('2026-01-01T00:00:00Z');
const thread = (id: string, resourceId = 'owner'): StorageThreadType => ({
  id,
  resourceId,
  title: id,
  createdAt: date,
  updatedAt: date,
});
const message = (id: string, threadId = 'thread', resourceId = 'owner'): MastraDBMessage => ({
  id,
  threadId,
  resourceId,
  role: 'assistant',
  createdAt: date,
  content: { format: 2, parts: [{ type: 'text', text: id }], metadata: { retained: true } },
});

async function collect<T extends { id: string }>(
  read: (cursor?: string | null) => Promise<MemoryScanPage<T>>,
  cursor?: string | null,
) {
  const records: T[] = [];
  do {
    const page = await read(cursor);
    records.push(...page.records);
    cursor = page.nextCursor;
  } while (cursor);
  return records;
}

describe('bounded native history scans', () => {
  let pool: Pool;
  let store: MemoryPG;
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.MEMORY_SCAN_TEST_DATABASE_URL ?? connectionString });
    store = new MemoryPG({ pool, schemaName });
    await store.init();
  }, 60_000);
  afterAll(async () => {
    try {
      await pool?.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await pool?.end();
    }
  });

  it('reproduces offset skipping under equal-count delete and insert', async () => {
    const resourceId = 'offset-reproduction';
    for (const id of ['a', 'b', 'c', 'd', 'e']) await store.saveThread({ thread: thread(`offset-${id}`, resourceId) });
    const first = await store.listThreads({
      filter: { resourceId },
      page: 0,
      perPage: 2,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    await store.deleteThread({ threadId: 'offset-a' });
    await store.saveThread({
      thread: { ...thread('offset-z', resourceId), createdAt: new Date('2026-02-01T00:00:00Z') },
    });
    const second = await store.listThreads({
      filter: { resourceId },
      page: 1,
      perPage: 2,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    expect(first.total).toBe(second.total);
    expect([...first.threads, ...second.threads].some(row => row.id === 'offset-c')).toBe(false);
  });

  it('retains thread coverage across deletion of the cursor row, equal-count replacement and restart', async () => {
    const resourceId = 'thread-scan';
    for (const id of ['a', 'b', 'c', 'd', 'e']) await store.saveThread({ thread: thread(`scan-${id}`, resourceId) });
    const first = await store.scanThreads({ resourceId, limit: 2 });
    expect(first.records.map(row => row.id)).toEqual(['scan-a', 'scan-b']);
    await store.deleteThread({ threadId: 'scan-b' });
    await store.saveThread({ thread: thread('scan-z', resourceId) });
    await store.updateThread({ id: 'scan-c', title: 'changed', metadata: { changed: true } });
    const restarted = new MemoryPG({ pool, schemaName });
    await restarted.init();
    const remaining = await collect(
      cursor => restarted.scanThreads({ cursor, resourceId, limit: 2 }),
      first.nextCursor,
    );
    expect(remaining.map(row => row.id)).toEqual(['scan-c', 'scan-d', 'scan-e']);
    expect(
      (await collect(cursor => restarted.scanThreads({ cursor, resourceId, limit: 2 }))).map(row => row.id),
    ).toContain('scan-z');
  });

  it('keeps message progress stable under date and metadata changes; inserts behind wait for the next scan', async () => {
    const resourceId = 'message-scan';
    await store.saveThread({ thread: thread('scan-message-thread', resourceId) });
    await store.saveMessages({
      messages: ['b', 'c', 'd', 'e', 'f'].map(id => message(`msg-${id}`, 'scan-message-thread', resourceId)),
    });
    const first = await store.scanMessages({ resourceId, limit: 2 });
    await store.deleteMessages(['msg-c']);
    await store.saveMessages({ messages: [message('msg-a', 'scan-message-thread', resourceId)] });
    await store.updateMessages({
      messages: [{ id: 'msg-d', content: { metadata: { retained: false } }, createdAt: new Date('2020-01-01') }],
    });
    const restarted = new MemoryPG({ pool, schemaName });
    await restarted.init();
    const rest = await collect(cursor => restarted.scanMessages({ cursor, resourceId, limit: 2 }), first.nextCursor);
    expect(rest.map(row => row.id)).toEqual(['msg-d', 'msg-e', 'msg-f']);
    expect(
      (await collect(cursor => restarted.scanMessages({ cursor, resourceId, limit: 2 }))).map(row => row.id),
    ).toEqual(['msg-a', 'msg-b', 'msg-d', 'msg-e', 'msg-f']);
  });

  it('includes orphaned messages and preserves resource and thread scope across pages', async () => {
    await store.saveThread({ thread: thread('deleted', 'orphan-owner') });
    await store.saveThread({ thread: thread('other', 'orphan-other') });
    await store.saveMessages({
      messages: [
        message('orphan-a', 'deleted', 'orphan-owner'),
        message('orphan-b', 'deleted', 'orphan-owner'),
        message('orphan-c', 'other', 'orphan-other'),
      ],
    });
    // Fixture an orphan without invoking deleteThread, which intentionally removes messages too.
    await pool.query(`DELETE FROM "${schemaName}".mastra_threads WHERE id = $1`, ['deleted']);
    const first = await store.scanMessages({ resourceId: 'orphan-owner', threadId: 'deleted', limit: 1 });
    expect(first.records[0]?.id).toBe('orphan-a');
    await expect(
      store.scanMessages({ resourceId: 'orphan-other', threadId: 'deleted', limit: 1, cursor: first.nextCursor }),
    ).rejects.toThrow('different query');
    await expect(
      store.scanMessages({ resourceId: 'orphan-owner', threadId: 'other', limit: 1, cursor: first.nextCursor }),
    ).rejects.toThrow('different query');
    await expect(store.scanThreads({ resourceId: 'orphan-owner', limit: 1, cursor: first.nextCursor })).rejects.toThrow(
      'different query',
    );
    const second = await store.scanMessages({
      resourceId: 'orphan-owner',
      threadId: 'deleted',
      limit: 1,
      cursor: first.nextCursor,
    });
    expect(second.records.map(row => row.id)).toEqual(['orphan-b']);
    expect(second.nextCursor).toBeNull();
    expect((await collect(cursor => store.scanMessages({ cursor, limit: 2 }))).map(row => row.id)).toContain(
      'orphan-c',
    );
  });

  it('ends empty and exact-size scans and rejects invalid limits, cursors and empty scopes', async () => {
    expect(await store.scanMessages({ resourceId: 'empty' })).toEqual({ records: [], nextCursor: null });
    await store.saveThread({ thread: thread('exact-thread', 'exact-owner') });
    await store.saveMessages({
      messages: [message('exact-a', 'exact-thread', 'exact-owner'), message('exact-b', 'exact-thread', 'exact-owner')],
    });
    const page = await store.scanMessages({ resourceId: 'exact-owner', limit: 2 });
    expect(page.records).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
    for (const limit of [0, -1, 501, 1.2, Number.NaN, false]) {
      await expect(store.scanMessages({ limit: limit as number })).rejects.toThrow('limit');
    }
    for (const cursor of ['', 'invalid', 'e30', 'bnVsbA', 4]) {
      await expect(store.scanMessages({ cursor: cursor as string })).rejects.toThrow('cursor');
    }
    await expect(store.scanMessages({ resourceId: '' })).rejects.toThrow('nonempty');
    await expect(store.scanMessages({ threadId: '' })).rejects.toThrow('nonempty');
  });

  it('preserves legacy rows without conversion or changing stored IDs', async () => {
    await pool.query(
      `INSERT INTO "${schemaName}".mastra_messages
      (id, content, role, type, "createdAt", thread_id, "resourceId") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['legacy-id', JSON.stringify('legacy text'), 'assistant', 'text', date, 'legacy-thread', 'legacy-owner'],
    );
    const page = await store.scanMessages({ resourceId: 'legacy-owner', limit: 1 });
    expect(page.records).toMatchObject([
      { id: 'legacy-id', content: 'legacy text', type: 'text', threadId: 'legacy-thread' },
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('creates native indexes for resource and thread ID scans', async () => {
    const indexes = await pool.query('SELECT indexdef FROM pg_indexes WHERE schemaname = $1', [schemaName]);
    const definitions = indexes.rows.map(row => row.indexdef).join('\n');
    expect(definitions).toContain('("resourceId", id)');
    expect(definitions).toContain('(thread_id, id)');
    expect(MemoryPG.getExportDDL(schemaName).join('\n')).toContain('mastra_messages_resourceid_id_idx');
  });

  it('initializes and exports the same bounded index names for long valid schemas', async () => {
    const longSchema = `memory_scan_${randomUUID().replaceAll('-', '')}`;
    try {
      const longStore = new MemoryPG({ pool, schemaName: longSchema });
      await longStore.init();
      const definitions = MemoryPG.getDefaultIndexDefs(`${longSchema}_`);
      const exported = MemoryPG.getExportDDL(longSchema).join('\n');
      const actual = await pool.query('SELECT indexname FROM pg_indexes WHERE schemaname = $1', [longSchema]);
      await new MemoryPG({ pool, schemaName: longSchema }).init();
      const repeated = await pool.query('SELECT indexname FROM pg_indexes WHERE schemaname = $1', [longSchema]);
      expect(repeated.rows.map(row => row.indexname).sort()).toEqual(actual.rows.map(row => row.indexname).sort());
      for (const definition of definitions) {
        expect(definition.name.length).toBeLessThanOrEqual(63);
        expect(actual.rows.map(row => row.indexname)).toContain(definition.name);
        expect(exported).toContain(`"${definition.name}"`);
      }
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${longSchema}" CASCADE`);
    }
  });
});

it('bounds native database reads and never requests offsets or totals', async () => {
  const manyOrNone = vi
    .fn()
    .mockResolvedValueOnce([{ id: 'd' }])
    .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const result = await scanById({
    client: { manyOrNone },
    table: 'native_table',
    select: 'id',
    scope: 'scope',
    input: { limit: 2 },
  });
  expect(result.records).toEqual([{ id: 'a' }, { id: 'b' }]);
  expect(manyOrNone.mock.calls[0][0]).toMatch(/LIMIT 1$/);
  expect(manyOrNone.mock.calls[1][1]).toEqual(['d', 3]);
  manyOrNone.mockReset().mockResolvedValueOnce([{ id: 'c' }, { id: 'd' }]);
  const last = await scanById({
    client: { manyOrNone },
    table: 'native_table',
    select: 'id',
    scope: 'scope',
    input: { limit: 2, cursor: result.nextCursor },
  });
  expect(last.nextCursor).toBeNull();
  expect(manyOrNone).toHaveBeenCalledTimes(1);
  expect(manyOrNone.mock.calls[0][1]).toEqual(['d', 'b', 3]);
  expect(manyOrNone.mock.calls[0][0]).not.toMatch(/OFFSET|COUNT/i);
});
