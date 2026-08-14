import { describe, expect, it } from 'vitest';

import { MemoryStorageDO } from './index';

function makeSql(threadRow: Record<string, unknown>) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const sql = {
    exec(query: string, ...params: unknown[]) {
      queries.push({ sql: query, params });
      return { toArray: () => (query.trim().toUpperCase().startsWith('SELECT') ? [threadRow] : []) };
    },
  };
  return { sql, queries };
}

describe('MemoryStorageDO updateThread', () => {
  const threadRow = {
    id: 'thread-1',
    resourceId: 'resource-1',
    title: 'Generated title',
    metadata: JSON.stringify({ a: 1 }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('keeps the stored title when only metadata is provided', async () => {
    const { sql, queries } = makeSql(threadRow);
    const memory = new MemoryStorageDO({ sql: sql as never });

    const updated = await memory.updateThread({ id: 'thread-1', metadata: { b: 2 } });

    expect(updated.title).toBe('Generated title');
    expect(updated.metadata).toEqual({ a: 1, b: 2 });

    const update = queries.find(query => query.sql.includes('UPDATE'));
    // The title column must not be written at all, so a title generated between
    // the read above and this write survives.
    expect(update?.sql).not.toContain('title');
    expect(update?.params).not.toContain('Generated title');
    expect(update?.params).not.toContain(undefined);
  });

  it('writes a new title when one is provided', async () => {
    const { sql, queries } = makeSql(threadRow);
    const memory = new MemoryStorageDO({ sql: sql as never });

    const updated = await memory.updateThread({ id: 'thread-1', title: 'New title' });

    expect(updated.title).toBe('New title');

    const update = queries.find(query => query.sql.includes('UPDATE'));
    expect(update?.params).toContain('New title');
    // Inverse of the metadata-only case: no metadata write on a title-only update.
    expect(update?.sql).not.toContain('metadata');
  });

  it('writes an explicit empty title', async () => {
    const { sql, queries } = makeSql(threadRow);
    const memory = new MemoryStorageDO({ sql: sql as never });

    const updated = await memory.updateThread({ id: 'thread-1', title: '' });

    expect(updated.title).toBe('');

    const update = queries.find(query => query.sql.includes('UPDATE'));
    expect(update?.sql).toContain('title');
    expect(update?.params).toContain('');
  });
});
