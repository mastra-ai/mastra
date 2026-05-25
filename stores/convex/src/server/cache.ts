import type { GenericMutationCtx as MutationCtx } from 'convex/server';
import { mutationGeneric } from 'convex/server';
import type { GenericId } from 'convex/values';

import type { CacheRequest, CacheResponse } from '../cache/types';

const CACHE_TABLE = 'mastra_cache';
const CACHE_LIST_TABLE = 'mastra_cache_list_items';
const CACHE_MUTATION_BATCH_SIZE = 25;

type CacheKind = 'value' | 'list' | 'counter' | 'deleted';
type CacheDoc = {
  _id: GenericId<string>;
  key: string;
  keyPrefix: string;
  kind: CacheKind;
  value?: string;
  counter?: number;
  expiresAt: number | null;
};
type CacheListItem = {
  _id: GenericId<string>;
  key: string;
  keyPrefix: string;
  index: number;
  value: string;
};
type DeleteBatchResult = {
  hasMore: boolean;
};

function encodeValue(value: unknown): string {
  // The cache wire format stores JSON strings; undefined is represented as null.
  return JSON.stringify(value === undefined ? null : value);
}

function decodeValue(value: string): unknown {
  return JSON.parse(value);
}

function isExpired(doc: { expiresAt: number | null }, now: number): boolean {
  return doc.expiresAt !== null && doc.expiresAt <= now;
}

function normalizeListRange(from: number, to: number, length: number): { from: number; to: number } | null {
  const normalizedFrom = from < 0 ? Math.max(length + from, 0) : from;
  const normalizedTo = to < 0 ? length + to : to;
  if (normalizedTo < normalizedFrom || normalizedFrom >= length) return null;
  return { from: normalizedFrom, to: normalizedTo };
}

async function findCacheDoc(ctx: MutationCtx<any>, key: string): Promise<CacheDoc | null> {
  return (await ctx.db
    .query(CACHE_TABLE)
    .withIndex('by_key', (q: any) => q.eq('key', key))
    .first()) as CacheDoc | null;
}

async function deleteCacheKey(ctx: MutationCtx<any>, key: string): Promise<DeleteBatchResult> {
  const [doc, listItems] = await Promise.all([
    findCacheDoc(ctx, key),
    ctx.db
      .query(CACHE_LIST_TABLE)
      .withIndex('by_key_index', (q: any) => q.eq('key', key))
      .take(CACHE_MUTATION_BATCH_SIZE + 1),
  ]);

  if (doc && doc.kind !== 'deleted') {
    await ctx.db.patch(doc._id, { kind: 'deleted' });
  }

  for (const item of listItems.slice(0, CACHE_MUTATION_BATCH_SIZE) as CacheListItem[]) {
    await ctx.db.delete(item._id);
  }

  const hasMore = listItems.length > CACHE_MUTATION_BATCH_SIZE;
  if (doc && !hasMore) {
    await ctx.db.delete(doc._id);
  }

  return {
    hasMore,
  };
}

async function getLiveCacheDoc(
  ctx: MutationCtx<any>,
  key: string,
  now: number,
): Promise<{ doc: CacheDoc | null; hasMore: boolean }> {
  const doc = await findCacheDoc(ctx, key);
  if (!doc) return { doc: null, hasMore: false };
  if (doc.kind === 'deleted') {
    const cleanup = await deleteCacheKey(ctx, key);
    return { doc: null, hasMore: cleanup.hasMore };
  }
  if (!isExpired(doc, now)) return { doc, hasMore: false };

  const cleanup = await deleteCacheKey(ctx, key);
  return { doc: null, hasMore: cleanup.hasMore };
}

async function writeCacheDoc(
  ctx: MutationCtx<any>,
  key: string,
  existing: CacheDoc | null,
  patch: Omit<CacheDoc, '_id' | 'key'>,
): Promise<CacheDoc> {
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return { ...existing, ...patch };
  }

  const _id = await ctx.db.insert(CACHE_TABLE, { key, ...patch });
  return { _id, key, ...patch };
}

async function clearPrefix(ctx: MutationCtx<any>, keyPrefix: string): Promise<boolean> {
  const [docs, orphanListItems] = await Promise.all([
    ctx.db
      .query(CACHE_TABLE)
      .withIndex('by_key_prefix', (q: any) => q.eq('keyPrefix', keyPrefix))
      .take(CACHE_MUTATION_BATCH_SIZE + 1),
    ctx.db
      .query(CACHE_LIST_TABLE)
      .withIndex('by_key_prefix', (q: any) => q.eq('keyPrefix', keyPrefix))
      .take(1),
  ]);

  if (docs.length > 0) {
    for (const doc of docs.slice(0, CACHE_MUTATION_BATCH_SIZE) as CacheDoc[]) {
      if (doc.kind === 'list' || doc.kind === 'deleted') {
        const cleanup = await deleteCacheKey(ctx, doc.key);
        return cleanup.hasMore || docs.length > 1 || orphanListItems.length > 0;
      }

      await ctx.db.delete(doc._id);
    }

    return docs.length > CACHE_MUTATION_BATCH_SIZE || orphanListItems.length > 0;
  }

  const listItems = (await ctx.db
    .query(CACHE_LIST_TABLE)
    .withIndex('by_key_prefix', (q: any) => q.eq('keyPrefix', keyPrefix))
    .take(CACHE_MUTATION_BATCH_SIZE + 1)) as CacheListItem[];

  for (const item of listItems.slice(0, CACHE_MUTATION_BATCH_SIZE)) {
    await ctx.db.delete(item._id);
  }

  return listItems.length > CACHE_MUTATION_BATCH_SIZE;
}

export async function handleCacheOperation(ctx: MutationCtx<any>, request: CacheRequest): Promise<CacheResponse> {
  const now = Date.now();

  switch (request.op) {
    case 'get': {
      const { doc, hasMore } = await getLiveCacheDoc(ctx, request.key, now);
      if (hasMore) return { ok: true, result: null, hasMore: true };
      if (!doc || doc.kind !== 'value') return { ok: true, result: null };
      return { ok: true, result: decodeValue(doc.value ?? 'null') };
    }

    case 'set': {
      let existing = await findCacheDoc(ctx, request.key);
      if (existing && (isExpired(existing, now) || existing.kind !== 'value')) {
        const cleanup = await deleteCacheKey(ctx, request.key);
        if (cleanup.hasMore) {
          return { ok: true, hasMore: true };
        }
        existing = null;
      }

      await writeCacheDoc(ctx, request.key, existing, {
        keyPrefix: request.keyPrefix,
        kind: 'value',
        value: encodeValue(request.value),
        expiresAt: request.expiresAt,
      });
      return { ok: true };
    }

    case 'listLength': {
      const { doc, hasMore } = await getLiveCacheDoc(ctx, request.key, now);
      if (hasMore) return { ok: true, result: 0, hasMore: true };
      if (!doc) return { ok: true, result: 0 };
      if (doc.kind !== 'list') return { ok: false, error: `${request.key} exists but is not an array` };

      return { ok: true, result: doc.counter ?? 0 };
    }

    case 'listPush': {
      let existing = await findCacheDoc(ctx, request.key);
      if (existing && (isExpired(existing, now) || existing.kind === 'deleted')) {
        const cleanup = await deleteCacheKey(ctx, request.key);
        if (cleanup.hasMore) {
          return { ok: true, hasMore: true };
        }
        existing = null;
      }
      if (existing && existing.kind !== 'list') {
        return { ok: false, error: `${request.key} exists but is not an array` };
      }

      const doc = existing
        ? await writeCacheDoc(ctx, request.key, existing, {
            kind: 'list',
            keyPrefix: request.keyPrefix,
            counter: (existing.counter ?? 0) + 1,
            expiresAt: request.expiresAt,
          })
        : await writeCacheDoc(ctx, request.key, null, {
            kind: 'list',
            keyPrefix: request.keyPrefix,
            counter: 1,
            expiresAt: request.expiresAt,
          });

      await ctx.db.insert(CACHE_LIST_TABLE, {
        key: request.key,
        keyPrefix: request.keyPrefix,
        index: (doc.counter ?? 1) - 1,
        value: encodeValue(request.value),
      });

      return { ok: true };
    }

    case 'listFromTo': {
      const { doc, hasMore } = await getLiveCacheDoc(ctx, request.key, now);
      if (hasMore) return { ok: true, result: [], hasMore: true };
      if (!doc || doc.kind !== 'list') return { ok: true, result: [] };

      const range = normalizeListRange(request.from, request.to, doc.counter ?? 0);
      if (!range) return { ok: true, result: [] };

      const query = ctx.db.query(CACHE_LIST_TABLE).withIndex('by_key_index', (q: any) => {
        return q.eq('key', request.key).gte('index', range.from).lte('index', range.to);
      });
      const items = (await query.collect()) as CacheListItem[];

      return { ok: true, result: items.map(item => decodeValue(item.value)) };
    }

    case 'delete': {
      const cleanup = await deleteCacheKey(ctx, request.key);
      return { ok: true, hasMore: cleanup.hasMore };
    }

    case 'clear': {
      const hasMore = await clearPrefix(ctx, request.keyPrefix);
      return { ok: true, hasMore };
    }

    case 'increment': {
      let existing = await findCacheDoc(ctx, request.key);
      if (existing && (isExpired(existing, now) || existing.kind === 'deleted')) {
        const cleanup = await deleteCacheKey(ctx, request.key);
        if (cleanup.hasMore) {
          return { ok: true, hasMore: true };
        }
        existing = null;
      }
      if (existing && existing.kind !== 'counter') {
        return { ok: false, error: `${request.key} exists but is not a number` };
      }

      const nextCounter = (existing?.counter ?? 0) + 1;
      await writeCacheDoc(ctx, request.key, existing, {
        kind: 'counter',
        keyPrefix: request.keyPrefix,
        counter: nextCounter,
        expiresAt: request.expiresAt,
      });

      return { ok: true, result: nextCounter };
    }
  }

  return { ok: false, error: `Unsupported operation ${(request as any).op}` };
}

export const mastraCache = mutationGeneric(
  async (ctx, request: CacheRequest): Promise<CacheResponse> => handleCacheOperation(ctx, request),
);
