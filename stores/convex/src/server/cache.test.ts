import { describe, expect, it } from 'vitest';

import { handleCacheOperation, mastraCache } from './cache';

type Row = Record<string, any> & { _id: string };

function createCtx(options: { failListItemInsert?: boolean } = {}) {
  let nextId = 0;
  const tables = new Map<string, Row[]>();

  const rows = (table: string) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  };

  const db = {
    async insert(table: string, record: Record<string, any>) {
      if (options.failListItemInsert && table === 'mastra_cache_list_items') {
        throw new Error('list item insert failed');
      }

      const doc = { _id: `${table}:${++nextId}`, ...record };
      rows(table).push(doc);
      return doc._id;
    },
    async delete(id: string) {
      for (const docs of tables.values()) {
        const index = docs.findIndex(doc => doc._id === id);
        if (index !== -1) docs.splice(index, 1);
      }
    },
    async patch(id: string, patch: Record<string, any>) {
      for (const docs of tables.values()) {
        const doc = docs.find(row => row._id === id);
        if (doc) Object.assign(doc, patch);
      }
    },
    query(table: string) {
      const filters: Array<(row: Row) => boolean> = [];

      const query = {
        withIndex(_index: string, cb: (q: any) => any) {
          const builder = {
            eq(field: string, value: unknown) {
              filters.push(row => row[field] === value);
              return builder;
            },
            gte(field: string, value: unknown) {
              filters.push(row => row[field] >= (value as any));
              return builder;
            },
            lte(field: string, value: unknown) {
              filters.push(row => row[field] <= (value as any));
              return builder;
            },
          };
          cb(builder);
          return query;
        },
        async collect() {
          return rows(table)
            .filter(row => filters.every(filter => filter(row)))
            .sort((a, b) => {
              if (a.key !== b.key) return String(a.key).localeCompare(String(b.key));
              return (a.index ?? 0) - (b.index ?? 0);
            });
        },
        async first() {
          return (await query.collect())[0] ?? null;
        },
        async take(count: number) {
          return (await query.collect()).slice(0, count);
        },
      };

      return query;
    },
  };

  return { db, tables };
}

async function clearUntilSettled(ctx: ReturnType<typeof createCtx>, keyPrefix: string) {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const result = await handleCacheOperation(ctx as any, { op: 'clear', keyPrefix });
    if (!result.ok) throw new Error(result.error);
    if (!result.hasMore) return result;
  }

  throw new Error('clear did not settle');
}

describe('mastraCache server handler', () => {
  it('lets mutation write failures propagate for Convex rollback', async () => {
    const ctx = createCtx({ failListItemInsert: true });

    await expect(
      (mastraCache as any)._handler(ctx, {
        op: 'listPush',
        key: 'mastra:cache:events',
        keyPrefix: 'mastra:cache:',
        value: 'event',
        expiresAt: null,
      }),
    ).rejects.toThrow('list item insert failed');
  });

  it('stores scalar values and expires them', async () => {
    const ctx = createCtx();

    await handleCacheOperation(ctx as any, {
      op: 'set',
      key: 'mastra:cache:key',
      keyPrefix: 'mastra:cache:',
      value: { ok: true },
      expiresAt: Date.now() + 1_000,
    });

    await expect(handleCacheOperation(ctx as any, { op: 'get', key: 'mastra:cache:key' })).resolves.toEqual({
      ok: true,
      result: { ok: true },
    });

    await handleCacheOperation(ctx as any, {
      op: 'set',
      key: 'mastra:cache:expired',
      keyPrefix: 'mastra:cache:',
      value: 'old',
      expiresAt: Date.now() - 1,
    });

    await expect(handleCacheOperation(ctx as any, { op: 'get', key: 'mastra:cache:expired' })).resolves.toEqual({
      ok: true,
      result: null,
    });
  });

  it('stores list values as separate ordered rows', async () => {
    const ctx = createCtx();

    await handleCacheOperation(ctx as any, {
      op: 'listPush',
      key: 'mastra:cache:events',
      keyPrefix: 'mastra:cache:',
      value: 'a',
      expiresAt: null,
    });
    await handleCacheOperation(ctx as any, {
      op: 'listPush',
      key: 'mastra:cache:events',
      keyPrefix: 'mastra:cache:',
      value: 'b',
      expiresAt: null,
    });
    await handleCacheOperation(ctx as any, {
      op: 'listPush',
      key: 'mastra:cache:events',
      keyPrefix: 'mastra:cache:',
      value: 'c',
      expiresAt: null,
    });

    await expect(handleCacheOperation(ctx as any, { op: 'listLength', key: 'mastra:cache:events' })).resolves.toEqual({
      ok: true,
      result: 3,
    });
    await expect(
      handleCacheOperation(ctx as any, { op: 'listFromTo', key: 'mastra:cache:events', from: 1, to: -1 }),
    ).resolves.toEqual({ ok: true, result: ['b', 'c'] });
    await expect(
      handleCacheOperation(ctx as any, { op: 'listFromTo', key: 'mastra:cache:events', from: 0, to: -2 }),
    ).resolves.toEqual({ ok: true, result: ['a', 'b'] });
    await expect(
      handleCacheOperation(ctx as any, { op: 'listFromTo', key: 'mastra:cache:events', from: -2, to: -1 }),
    ).resolves.toEqual({ ok: true, result: ['b', 'c'] });
  });

  it('refreshes list TTL on each push', async () => {
    const ctx = createCtx();
    const firstExpiresAt = Date.now() + 100_000;
    const secondExpiresAt = Date.now() + 200_000;

    await handleCacheOperation(ctx as any, {
      op: 'listPush',
      key: 'mastra:cache:events',
      keyPrefix: 'mastra:cache:',
      value: 'a',
      expiresAt: firstExpiresAt,
    });
    await handleCacheOperation(ctx as any, {
      op: 'listPush',
      key: 'mastra:cache:events',
      keyPrefix: 'mastra:cache:',
      value: 'b',
      expiresAt: secondExpiresAt,
    });

    expect(ctx.tables.get('mastra_cache')?.[0]).toMatchObject({
      key: 'mastra:cache:events',
      counter: 2,
      expiresAt: secondExpiresAt,
    });
  });

  it('increments counters and rejects type conflicts', async () => {
    const ctx = createCtx();

    await expect(
      handleCacheOperation(ctx as any, {
        op: 'increment',
        key: 'mastra:cache:counter',
        keyPrefix: 'mastra:cache:',
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: true, result: 1 });
    await expect(
      handleCacheOperation(ctx as any, {
        op: 'increment',
        key: 'mastra:cache:counter',
        keyPrefix: 'mastra:cache:',
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: true, result: 2 });

    await handleCacheOperation(ctx as any, {
      op: 'set',
      key: 'mastra:cache:value',
      keyPrefix: 'mastra:cache:',
      value: 'not-list',
      expiresAt: null,
    });

    await expect(
      handleCacheOperation(ctx as any, {
        op: 'listPush',
        key: 'mastra:cache:value',
        keyPrefix: 'mastra:cache:',
        value: 'item',
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: false, error: 'mastra:cache:value exists but is not an array' });

    await expect(
      handleCacheOperation(ctx as any, {
        op: 'increment',
        key: 'mastra:cache:value',
        keyPrefix: 'mastra:cache:',
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: false, error: 'mastra:cache:value exists but is not a number' });

    await handleCacheOperation(ctx as any, {
      op: 'listPush',
      key: 'mastra:cache:list',
      keyPrefix: 'mastra:cache:',
      value: 'item',
      expiresAt: null,
    });

    await expect(
      handleCacheOperation(ctx as any, {
        op: 'increment',
        key: 'mastra:cache:list',
        keyPrefix: 'mastra:cache:',
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: false, error: 'mastra:cache:list exists but is not a number' });
  });

  it('clears metadata and list rows by prefix', async () => {
    const ctx = createCtx();

    await handleCacheOperation(ctx as any, {
      op: 'set',
      key: 'mastra:cache:value',
      keyPrefix: 'mastra:cache:',
      value: 'cached',
      expiresAt: null,
    });
    await handleCacheOperation(ctx as any, {
      op: 'listPush',
      key: 'mastra:cache:events',
      keyPrefix: 'mastra:cache:',
      value: 'a',
      expiresAt: null,
    });
    await handleCacheOperation(ctx as any, {
      op: 'set',
      key: 'other:value',
      keyPrefix: 'other:',
      value: 'kept',
      expiresAt: null,
    });

    await expect(clearUntilSettled(ctx, 'mastra:cache:')).resolves.toEqual({ ok: true, hasMore: false });
    await expect(handleCacheOperation(ctx as any, { op: 'get', key: 'mastra:cache:value' })).resolves.toEqual({
      ok: true,
      result: null,
    });
    await expect(handleCacheOperation(ctx as any, { op: 'listLength', key: 'mastra:cache:events' })).resolves.toEqual({
      ok: true,
      result: 0,
    });
    await expect(handleCacheOperation(ctx as any, { op: 'get', key: 'other:value' })).resolves.toEqual({
      ok: true,
      result: 'kept',
    });
  });

  it('continues clear across multiple batches', async () => {
    const ctx = createCtx();

    for (let index = 0; index < 27; index += 1) {
      await handleCacheOperation(ctx as any, {
        op: 'set',
        key: `mastra:cache:value:${index}`,
        keyPrefix: 'mastra:cache:',
        value: index,
        expiresAt: null,
      });
    }

    await expect(handleCacheOperation(ctx as any, { op: 'clear', keyPrefix: 'mastra:cache:' })).resolves.toEqual({
      ok: true,
      hasMore: true,
    });
    expect(ctx.tables.get('mastra_cache')).toHaveLength(2);

    await expect(handleCacheOperation(ctx as any, { op: 'clear', keyPrefix: 'mastra:cache:' })).resolves.toEqual({
      ok: true,
      hasMore: false,
    });
    expect(ctx.tables.get('mastra_cache')).toHaveLength(0);
  });

  it('settles clear on an exact scalar batch boundary', async () => {
    const ctx = createCtx();

    for (let index = 0; index < 25; index += 1) {
      await handleCacheOperation(ctx as any, {
        op: 'set',
        key: `mastra:cache:value:${index}`,
        keyPrefix: 'mastra:cache:',
        value: index,
        expiresAt: null,
      });
    }

    await expect(handleCacheOperation(ctx as any, { op: 'clear', keyPrefix: 'mastra:cache:' })).resolves.toEqual({
      ok: true,
      hasMore: false,
    });
    expect(ctx.tables.get('mastra_cache')).toHaveLength(0);
  });

  it('continues expired large-list cleanup across reads', async () => {
    const ctx = createCtx();

    for (let index = 0; index < 27; index += 1) {
      await handleCacheOperation(ctx as any, {
        op: 'listPush',
        key: 'mastra:cache:events',
        keyPrefix: 'mastra:cache:',
        value: `event-${index}`,
        expiresAt: Date.now() + 1_000,
      });
    }

    const cacheDocs = ctx.tables.get('mastra_cache')!;
    cacheDocs[0]!.expiresAt = Date.now() - 1;

    await expect(handleCacheOperation(ctx as any, { op: 'listLength', key: 'mastra:cache:events' })).resolves.toEqual({
      ok: true,
      result: 0,
      hasMore: true,
    });
    expect(ctx.tables.get('mastra_cache_list_items')).toHaveLength(2);
    expect(ctx.tables.get('mastra_cache')).toHaveLength(1);

    await expect(handleCacheOperation(ctx as any, { op: 'listLength', key: 'mastra:cache:events' })).resolves.toEqual({
      ok: true,
      result: 0,
    });
    expect(ctx.tables.get('mastra_cache_list_items')).toHaveLength(0);
    expect(ctx.tables.get('mastra_cache')).toHaveLength(0);
  });

  it('sets a scalar over an existing large list across cleanup batches', async () => {
    const ctx = createCtx();

    for (let index = 0; index < 27; index += 1) {
      await handleCacheOperation(ctx as any, {
        op: 'listPush',
        key: 'mastra:cache:events',
        keyPrefix: 'mastra:cache:',
        value: `event-${index}`,
        expiresAt: null,
      });
    }

    const request = {
      op: 'set' as const,
      key: 'mastra:cache:events',
      keyPrefix: 'mastra:cache:',
      value: 'done',
      expiresAt: null,
    };

    await expect(handleCacheOperation(ctx as any, request)).resolves.toEqual({ ok: true, hasMore: true });
    expect(ctx.tables.get('mastra_cache_list_items')).toHaveLength(2);

    await expect(handleCacheOperation(ctx as any, request)).resolves.toEqual({ ok: true });
    await expect(handleCacheOperation(ctx as any, { op: 'get', key: 'mastra:cache:events' })).resolves.toEqual({
      ok: true,
      result: 'done',
    });
    expect(ctx.tables.get('mastra_cache_list_items')).toHaveLength(0);
  });

  it('does not replay stale list rows after prefix clear and same-key rewrite', async () => {
    const ctx = createCtx();

    for (let index = 0; index < 60; index += 1) {
      await handleCacheOperation(ctx as any, {
        op: 'listPush',
        key: 'mastra:cache:events',
        keyPrefix: 'mastra:cache:',
        value: `old-${index}`,
        expiresAt: null,
      });
    }

    await expect(handleCacheOperation(ctx as any, { op: 'clear', keyPrefix: 'mastra:cache:' })).resolves.toEqual({
      ok: true,
      hasMore: true,
    });

    await expect(
      handleCacheOperation(ctx as any, {
        op: 'listPush',
        key: 'mastra:cache:events',
        keyPrefix: 'mastra:cache:',
        value: 'new',
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: true, hasMore: true });

    await expect(
      handleCacheOperation(ctx as any, {
        op: 'listPush',
        key: 'mastra:cache:events',
        keyPrefix: 'mastra:cache:',
        value: 'new',
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      handleCacheOperation(ctx as any, { op: 'listFromTo', key: 'mastra:cache:events', from: 0, to: -1 }),
    ).resolves.toEqual({ ok: true, result: ['new'] });
    expect(ctx.tables.get('mastra_cache_list_items')).toHaveLength(1);
  });

  it('replaces expired list and counter entries after cleanup completes', async () => {
    const ctx = createCtx();

    await handleCacheOperation(ctx as any, {
      op: 'listPush',
      key: 'mastra:cache:events',
      keyPrefix: 'mastra:cache:',
      value: 'old',
      expiresAt: Date.now() - 1,
    });

    await expect(
      handleCacheOperation(ctx as any, {
        op: 'listPush',
        key: 'mastra:cache:events',
        keyPrefix: 'mastra:cache:',
        value: 'new',
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      handleCacheOperation(ctx as any, { op: 'listFromTo', key: 'mastra:cache:events', from: 0, to: -1 }),
    ).resolves.toEqual({ ok: true, result: ['new'] });

    await handleCacheOperation(ctx as any, {
      op: 'increment',
      key: 'mastra:cache:counter',
      keyPrefix: 'mastra:cache:',
      expiresAt: Date.now() - 1,
    });

    await expect(
      handleCacheOperation(ctx as any, {
        op: 'increment',
        key: 'mastra:cache:counter',
        keyPrefix: 'mastra:cache:',
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: true, result: 1 });
  });
});
