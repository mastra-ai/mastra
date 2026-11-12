import { CachingPubSub, EventEmitterPubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';
import { describe, expect, it, vi } from 'vitest';

import { ConvexServerCache } from '../cache';
import type { ConvexCacheClient } from '../cache';
import type { CacheRequest } from '../cache/types';
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

/**
 * Routes ConvexServerCache requests to the real handler. Like a Convex
 * mutation, a request that throws leaves no writes behind. `loseResponse`
 * models a request that committed but whose response never reached the client.
 */
function createTransactionalClient(ctx: ReturnType<typeof createCtx>) {
  const faults = { loseResponse: false };

  const callCacheRaw = async <T>(request: CacheRequest): Promise<{ result: T; hasMore?: boolean }> => {
    const snapshot = new Map([...ctx.tables].map(([table, docs]) => [table, docs.map(doc => ({ ...doc }))]));
    let response;
    try {
      response = await handleCacheOperation(ctx as any, request);
    } catch (error) {
      ctx.tables.clear();
      for (const [table, docs] of snapshot) ctx.tables.set(table, docs);
      throw error;
    }
    if (!response.ok) throw new Error(response.error);
    if (faults.loseResponse) {
      faults.loseResponse = false;
      throw new Error('Convex cache request timed out after 30000 ms.');
    }
    return { result: response.result as T, hasMore: response.hasMore };
  };

  const client = {
    callCacheRaw,
    callCache: async <T>(request: CacheRequest) => (await callCacheRaw<T>(request)).result,
  } as unknown as ConvexCacheClient;

  return { client, faults };
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

  it('reads counters back as numbers', async () => {
    const ctx = createCtx();
    const get = (key: string) => handleCacheOperation(ctx as any, { op: 'get', key });

    await expect(get('mastra:cache:counter')).resolves.toEqual({ ok: true, result: null });
    for (let i = 0; i < 2; i++) {
      await handleCacheOperation(ctx as any, {
        op: 'increment',
        key: 'mastra:cache:counter',
        keyPrefix: 'mastra:cache:',
        expiresAt: null,
      });
    }
    await expect(get('mastra:cache:counter')).resolves.toEqual({ ok: true, result: 2 });

    for (let i = 0; i < 3; i++) {
      await handleCacheOperation(ctx as any, {
        op: 'listPushIndexed',
        key: 'mastra:cache:log',
        counterKey: 'mastra:cache:log:counter',
        keyPrefix: 'mastra:cache:',
        value: { id: `frame-${i}` },
        expiresAt: null,
      });
    }
    await expect(get('mastra:cache:log:counter')).resolves.toEqual({ ok: true, result: 3 });
    // Lists still read as null through `get`.
    await expect(get('mastra:cache:log')).resolves.toEqual({ ok: true, result: null });
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
  it('allocates indices and appends indexed entries in one operation', async () => {
    const ctx = createCtx();
    const expiresAt = Date.now() + 100_000;
    const push = (value: Record<string, unknown>) =>
      handleCacheOperation(ctx as any, {
        op: 'listPushIndexed',
        key: 'mastra:cache:log',
        counterKey: 'mastra:cache:log:counter',
        keyPrefix: 'mastra:cache:',
        value,
        expiresAt,
      });

    await expect(push({ id: 'a' })).resolves.toEqual({ ok: true, result: 0 });
    await expect(push({ id: 'b', index: 99 })).resolves.toEqual({ ok: true, result: 1 });

    await expect(
      handleCacheOperation(ctx as any, { op: 'listFromTo', key: 'mastra:cache:log', from: 0, to: -1 }),
    ).resolves.toEqual({
      ok: true,
      result: [
        { id: 'a', index: 0 },
        { id: 'b', index: 1 },
      ],
    });
    // The list and its counter expire together.
    expect(ctx.tables.get('mastra_cache')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'mastra:cache:log', kind: 'list', counter: 2, expiresAt }),
        expect.objectContaining({ key: 'mastra:cache:log:counter', kind: 'counter', counter: 2, expiresAt }),
      ]),
    );
  });

  it('restarts indexed lists after expiry and rejects type conflicts', async () => {
    const ctx = createCtx();
    const push = (expiresAt: number | null) =>
      handleCacheOperation(ctx as any, {
        op: 'listPushIndexed',
        key: 'mastra:cache:log',
        counterKey: 'mastra:cache:log:counter',
        keyPrefix: 'mastra:cache:',
        value: { id: 'x' },
        expiresAt,
      });

    await push(Date.now() - 1);
    await expect(push(null)).resolves.toEqual({ ok: true, result: 0 });
    await expect(
      handleCacheOperation(ctx as any, { op: 'listFromTo', key: 'mastra:cache:log', from: 0, to: -1 }),
    ).resolves.toEqual({ ok: true, result: [{ id: 'x', index: 0 }] });

    await handleCacheOperation(ctx as any, {
      op: 'set',
      key: 'mastra:cache:other',
      keyPrefix: 'mastra:cache:',
      value: 'scalar',
      expiresAt: null,
    });
    await expect(
      handleCacheOperation(ctx as any, {
        op: 'listPushIndexed',
        key: 'mastra:cache:other',
        counterKey: 'mastra:cache:log:counter',
        keyPrefix: 'mastra:cache:',
        value: {},
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: false, error: 'mastra:cache:other exists but is not an array' });
    await expect(
      handleCacheOperation(ctx as any, {
        op: 'listPushIndexed',
        key: 'mastra:cache:log',
        counterKey: 'mastra:cache:other',
        keyPrefix: 'mastra:cache:',
        value: {},
        expiresAt: null,
      }),
    ).resolves.toEqual({ ok: false, error: 'mastra:cache:other exists but is not a number' });
  });

  describe('allocates indices safely when the counter document has drifted', () => {
    const seedList = async (ctx: ReturnType<typeof createCtx>, length: number) => {
      for (let i = 0; i < length; i++) {
        await handleCacheOperation(ctx as any, {
          op: 'listPush',
          key: 'mastra:cache:log',
          keyPrefix: 'mastra:cache:',
          value: { id: `seed-${i}`, index: i },
          expiresAt: null,
        });
      }
    };
    const pushAndReadLast = async (ctx: ReturnType<typeof createCtx>) => {
      const pushed = await handleCacheOperation(ctx as any, {
        op: 'listPushIndexed',
        key: 'mastra:cache:log',
        counterKey: 'mastra:cache:log:counter',
        keyPrefix: 'mastra:cache:',
        value: { id: 'next' },
        expiresAt: null,
      });
      const rows = ctx.tables.get('mastra_cache_list_items')!;
      return { pushed, row: rows[rows.length - 1]! };
    };

    it('never reuses an index when the counter document is ahead of the list', async () => {
      const ctx = createCtx();
      await seedList(ctx, 2);
      for (let i = 0; i < 3; i++) {
        await handleCacheOperation(ctx as any, {
          op: 'increment',
          key: 'mastra:cache:log:counter',
          keyPrefix: 'mastra:cache:',
          expiresAt: null,
        });
      }

      const { pushed, row } = await pushAndReadLast(ctx);

      // A client may already hold index 2 from the old non-atomic path, so the
      // new frame must not be stamped 2 again. It is stored at its index,
      // leaving a gap at position 2, so replay by offset still lines up.
      expect(pushed).toEqual({ ok: true, result: 3 });
      expect(row).toMatchObject({ index: 3 });
      expect(JSON.parse(row.value as string)).toEqual({ id: 'next', index: 3 });
      await expect(pushAndReadLast(ctx)).resolves.toMatchObject({ pushed: { ok: true, result: 4 }, row: { index: 4 } });

      // A client that received index 3 and resumes at offset 4 gets index 4.
      const readFrom = (from: number) =>
        handleCacheOperation(ctx as any, { op: 'listFromTo', key: 'mastra:cache:log', from, to: -1 });
      await expect(readFrom(4)).resolves.toEqual({ ok: true, result: [{ id: 'next', index: 4 }] });
      await expect(readFrom(3)).resolves.toEqual({
        ok: true,
        result: [
          { id: 'next', index: 3 },
          { id: 'next', index: 4 },
        ],
      });
      await expect(
        handleCacheOperation(ctx as any, {
          op: 'increment',
          key: 'mastra:cache:log:counter',
          keyPrefix: 'mastra:cache:',
          expiresAt: null,
        }),
      ).resolves.toEqual({ ok: true, result: 6 });
    });

    it('keeps indices aligned with positions when the counter document is missing', async () => {
      const ctx = createCtx();
      await seedList(ctx, 3);

      const { pushed, row } = await pushAndReadLast(ctx);

      expect(pushed).toEqual({ ok: true, result: 3 });
      expect(row).toMatchObject({ index: 3 });
      expect(JSON.parse(row.value as string)).toEqual({ id: 'next', index: 3 });
    });
  });
});

describe('CachingPubSub replay over ConvexServerCache', () => {
  const topic = 'workflow.events.v2.run-1';

  async function setup() {
    const options = { failListItemInsert: false };
    const ctx = createCtx(options);
    const { client, faults } = createTransactionalClient(ctx);
    const cache = new ConvexServerCache({ client });
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), cache);
    const publish = (n: number) => pubsub.publish(topic, { type: 'frame', data: { n }, runId: 'run-1' });
    const frames = (events: Event[]) =>
      events.map(event => ({ index: event.index, n: (event.data as { n: number }).n }));
    const replay = async (offset: number) => {
      const received: Event[] = [];
      await pubsub.subscribeFromOffset(topic, offset, event => {
        received.push(event);
      });
      await vi.waitFor(() => expect(received.length).toBeGreaterThan(0));
      return frames(received);
    };
    return { options, faults, cache, pubsub, publish, frames, replay };
  }

  it('reads only the tail of the log when resuming from an offset', async () => {
    const { cache, publish, replay } = await setup();
    for (let n = 0; n < 6; n++) await publish(n);
    const listFromTo = vi.spyOn(cache, 'listFromTo');

    await expect(replay(4)).resolves.toEqual([
      { index: 4, n: 4 },
      { index: 5, n: 5 },
    ]);
    // The counter reads back as a number, so the replay slices the log at the
    // offset instead of reading it from the start. (`[key, 0, 0]` is the
    // single-entry read of frame 0's id for restart detection.)
    expect(listFromTo.mock.calls).toEqual([
      ['pubsub:{workflow.events.v2.run-1}', 0, 0],
      ['pubsub:{workflow.events.v2.run-1}', 4],
    ]);
  });

  it('resyncs a resumed subscriber when the log restarts at 0', async () => {
    const { cache, pubsub, publish, frames } = await setup();
    for (let n = 0; n < 3; n++) await publish(n);

    const received: Event[] = [];
    await pubsub.subscribeFromOffset(topic, 3, event => {
      received.push(event);
    });

    // The retained log expires and the run publishes a new segment.
    await cache.delete('pubsub:{workflow.events.v2.run-1}');
    await cache.delete('pubsub:{workflow.events.v2.run-1}:counter');
    await publish(100);

    await vi.waitFor(() => expect(frames(received)).toEqual([{ index: 0, n: 100 }]));
  });

  it('resumes from an offset without skipping frames after a publish fails to cache', async () => {
    const { options, publish, replay } = await setup();

    await publish(0);
    await publish(1);
    options.failListItemInsert = true;
    await publish(2); // caching fails and rolls back; delivered live only
    options.failListItemInsert = false;
    await publish(3);
    await publish(4);
    await publish(5);

    // Frame 2 never reached the log, so the next frame took index 2 and every
    // index still matches its list position.
    await expect(replay(3)).resolves.toEqual([
      { index: 3, n: 4 },
      { index: 4, n: 5 },
    ]);
    await expect(replay(0)).resolves.toEqual([
      { index: 0, n: 0 },
      { index: 1, n: 1 },
      { index: 2, n: 3 },
      { index: 3, n: 4 },
      { index: 4, n: 5 },
    ]);
  });

  it('keeps a frame whose cache write committed but whose response was lost', async () => {
    const { faults, publish, replay } = await setup();

    await publish(0);
    await publish(1);
    faults.loseResponse = true;
    await publish(2);
    await publish(3);

    await expect(replay(2)).resolves.toEqual([
      { index: 2, n: 2 },
      { index: 3, n: 3 },
    ]);
  });
});
