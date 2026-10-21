import type { GenericId } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RunClaimRequest, StorageRequest, StorageResponse, StoredRunClaim } from '../storage/types';
import { handleRunClaimOperation, RUN_FENCE_CONFLICT_CODE } from './run-fencing';

type Doc = { _id: GenericId<string>; table: string; primaryKey: string; record: StoredRunClaim };

function createCtx() {
  const docs: Doc[] = [];
  let nextId = 0;
  const db = {
    query: vi.fn(() => ({
      withIndex: (_index: string, build: (q: any) => any) => {
        const filters: Record<string, string> = {};
        const q = {
          eq: (field: string, value: string) => {
            filters[field] = value;
            return q;
          },
        };
        build(q);
        const matches = () =>
          docs.filter(
            doc =>
              doc.table === filters.table &&
              (filters.primaryKey === undefined || doc.primaryKey === filters.primaryKey),
          );
        // Convex orders undefined < null < numbers.
        const rank = (v: unknown) => (v === undefined ? 0 : v === null ? 1 : 2);
        const cmp = (a: any, b: any) => (rank(a) !== rank(b) ? rank(a) - rank(b) : rank(a) === 2 ? a - b : 0);
        const val = (doc: Doc, x: any) => (typeof x === 'function' ? x(doc) : x);
        const fq = {
          field: (path: string) => (doc: any) => path.split('.').reduce((o, k) => o?.[k], doc),
          gt: (a: any, b: any) => (doc: Doc) => cmp(val(doc, a), val(doc, b)) > 0,
          lt: (a: any, b: any) => (doc: Doc) => cmp(val(doc, a), val(doc, b)) < 0,
          and:
            (...ps: any[]) =>
            (doc: Doc) =>
              ps.every(p => p(doc)),
        };
        return {
          unique: async () => matches()[0] ?? null,
          filter: (build: (q: any) => (doc: Doc) => boolean) => {
            const pred = build(fq);
            return { take: async (n: number) => matches().filter(pred).slice(0, n) };
          },
        };
      },
    })),
    insert: vi.fn(async (_table: string, value: Omit<Doc, '_id'>) => {
      const doc = { _id: `doc-${nextId++}` as GenericId<string>, ...value };
      docs.push(doc);
      return doc._id;
    }),
    delete: vi.fn(async (id: GenericId<string>) => {
      docs.splice(
        docs.findIndex(doc => doc._id === id),
        1,
      );
    }),
    patch: vi.fn(async (id: GenericId<string>, value: Partial<Doc>) => {
      Object.assign(
        docs.find(doc => doc._id === id)!,
        value,
      );
    }),
  };
  return { ctx: { db } as any, docs };
}

const OWNERS = 'mastra_workflow_run_owners' as const;
const FENCES = 'mastra_memory_run_fences' as const;
const NOW = 1_000_000;

describe('Convex run fencing handler', () => {
  let ctx: any;
  let docs: Doc[];
  const route = vi.fn(async (_ctx: any, _request: StorageRequest): Promise<StorageResponse> => ({ ok: true }));

  const run = (request: RunClaimRequest) => handleRunClaimOperation(ctx, request, route) as Promise<any>;
  const claim = (extra: { ownerId?: string; force?: boolean; expectedGeneration?: number } = {}) =>
    run({
      op: 'claimRunOwnership',
      tableName: OWNERS,
      runId: 'run-1',
      ownerId: 'a',
      leaseMs: 1000,
      force: false,
      ...extra,
    });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    ({ ctx, docs } = createCtx());
    route.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('seeds the first generation from the clock', async () => {
    const res = await claim();
    expect(res.result.applied).toBe(true);
    expect(res.result.claim).toMatchObject({ generation: NOW, ownerId: 'a', leaseExpiresAt: NOW + 1000 });
    expect(docs).toHaveLength(1);
  });

  it('rejects a claim while another owner holds a live lease, and allows force', async () => {
    await claim();
    const blocked = await claim({ ownerId: 'b' });
    expect(blocked.result.applied).toBe(false);
    expect(blocked.result.claim.ownerId).toBe('a');

    const forced = await claim({ ownerId: 'b', force: true });
    expect(forced.result.applied).toBe(true);
    expect(forced.result.claim).toMatchObject({ ownerId: 'b', generation: NOW + 1 });
  });

  it('takes over an expired lease with the next generation', async () => {
    await claim();
    vi.setSystemTime(NOW + 2000);
    const res = await claim({ ownerId: 'b' });
    expect(res.result.applied).toBe(true);
    expect(res.result.claim).toMatchObject({ ownerId: 'b', generation: NOW + 1 });
  });

  it('rejects a stale expectedGeneration', async () => {
    expect((await claim({ expectedGeneration: 5 })).result.applied).toBe(false);
    await claim();
    const stale = await claim({ ownerId: 'b', force: true, expectedGeneration: NOW - 1 });
    expect(stale.result.applied).toBe(false);
    const current = await claim({ ownerId: 'b', force: true, expectedGeneration: NOW });
    expect(current.result.applied).toBe(true);
  });

  it('renews and releases only for the current holder', async () => {
    await claim();
    const fence = { runId: 'run-1', generation: NOW, ownerId: 'a' };
    const wrong = { ...fence, ownerId: 'b' };

    vi.setSystemTime(NOW + 500);
    expect(
      (await run({ op: 'renewRunOwnership', tableName: OWNERS, fence: wrong, leaseMs: 1000 })).result.applied,
    ).toBe(false);
    const renewed = await run({ op: 'renewRunOwnership', tableName: OWNERS, fence, leaseMs: 1000 });
    expect(renewed.result.claim.leaseExpiresAt).toBe(NOW + 1500);

    expect((await run({ op: 'releaseRunOwnership', tableName: OWNERS, fence: wrong })).result.applied).toBe(false);
    const released = await run({ op: 'releaseRunOwnership', tableName: OWNERS, fence });
    expect(released.result.claim.leaseExpiresAt).toBeNull();
    // A released claim can't be renewed.
    expect((await run({ op: 'renewRunOwnership', tableName: OWNERS, fence, leaseMs: 1000 })).result.applied).toBe(
      false,
    );
  });

  it('only raises a fence upward, reaffirms its own, and un-retires it', async () => {
    const fence = { runId: 'run-1', generation: 5, ownerId: 'a' };
    expect((await run({ op: 'raiseRunFence', tableName: FENCES, fence })).result.applied).toBe(true);
    expect((await run({ op: 'retireRunFence', tableName: FENCES, fence })).result.claim.retiredAt).toBe(NOW);

    const lower = await run({
      op: 'raiseRunFence',
      tableName: FENCES,
      fence: { ...fence, generation: 4, ownerId: 'b' },
    });
    expect(lower.result.applied).toBe(false);
    const sameGenOtherOwner = await run({ op: 'raiseRunFence', tableName: FENCES, fence: { ...fence, ownerId: 'b' } });
    expect(sameGenOtherOwner.result.applied).toBe(false);

    const reaffirmed = await run({ op: 'raiseRunFence', tableName: FENCES, fence });
    expect(reaffirmed.result.applied).toBe(true);
    expect(reaffirmed.result.claim.retiredAt).toBeNull();

    const higher = await run({
      op: 'raiseRunFence',
      tableName: FENCES,
      fence: { ...fence, generation: 6, ownerId: 'b' },
    });
    expect(higher.result.claim).toMatchObject({ generation: 6, ownerId: 'b' });
    expect((await run({ op: 'retireRunFence', tableName: FENCES, fence })).result.applied).toBe(false);
  });

  it('routes a fenced request only while the fence holds the run', async () => {
    await claim();
    const inner = { op: 'insert', tableName: 'mastra_messages', record: { id: 'm1' } } as unknown as StorageRequest;
    const fence = { runId: 'run-1', generation: NOW, ownerId: 'a' };

    expect(await run({ op: 'fenced', tableName: OWNERS, fence, request: inner })).toEqual({ ok: true });
    expect(route).toHaveBeenCalledWith(ctx, inner);

    route.mockClear();
    await claim({ ownerId: 'b', force: true });
    const rejected = await run({ op: 'fenced', tableName: OWNERS, fence, request: inner });
    expect(rejected).toMatchObject({ ok: false, code: RUN_FENCE_CONFLICT_CODE });
    expect(route).not.toHaveBeenCalled();
  });

  it('refuses to nest claim operations or use other tables', async () => {
    await claim();
    const fence = { runId: 'run-1', generation: NOW, ownerId: 'a' };
    const nested = await run({
      op: 'fenced',
      tableName: OWNERS,
      fence,
      request: { op: 'raiseRunFence', tableName: FENCES, fence } as unknown as StorageRequest,
    });
    expect(nested).toMatchObject({ ok: false });
    expect(route).not.toHaveBeenCalled();

    expect(await run({ op: 'getRunOwnership', tableName: 'mastra_threads' as any, runId: 'run-1' })).toMatchObject({
      ok: false,
    });
  });

  it('prunes claims idle past the cutoff and keeps recent ones', async () => {
    await claim();
    vi.setSystemTime(NOW + 10_000);
    await run({
      op: 'claimRunOwnership',
      tableName: OWNERS,
      runId: 'run-2',
      ownerId: 'a',
      leaseMs: 1000,
      force: false,
    });
    const res = await run({
      op: 'pruneRunClaims',
      tableName: OWNERS,
      column: 'updatedAt',
      cutoff: NOW + 5_000,
      limit: 10,
    });
    expect(res.result).toBe(1);
    expect(docs.map(doc => doc.primaryKey)).toEqual(['run-2']);
  });

  it('prunes only retired fences, respecting the limit', async () => {
    for (const runId of ['f1', 'f2', 'live']) {
      await run({ op: 'raiseRunFence', tableName: FENCES, fence: { runId, ownerId: 'a', generation: 1 } } as any);
    }
    await run({ op: 'retireRunFence', tableName: FENCES, fence: { runId: 'f1', ownerId: 'a', generation: 1 } });
    await run({ op: 'retireRunFence', tableName: FENCES, fence: { runId: 'f2', ownerId: 'a', generation: 1 } });
    vi.setSystemTime(NOW + 10_000);
    const prune = (limit: number) =>
      run({ op: 'pruneRunClaims', tableName: FENCES, column: 'retiredAt', cutoff: NOW + 5_000, limit });
    expect((await prune(1)).result).toBe(1);
    expect((await prune(10)).result).toBe(1);
    expect(docs.map(doc => doc.primaryKey)).toEqual(['live']);
  });
});
