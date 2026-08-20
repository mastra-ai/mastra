import type { IMastraLogger } from '@mastra/core/logger';
import { EntityType } from '@mastra/core/observability';
import { describe, expect, it, vi } from 'vitest';

import type { DbClient, TxClient } from '../../../client';
import { TABLE_LOG_EVENTS, TABLE_METRIC_EVENTS, TABLE_SPAN_EVENTS } from './ddl';
import { getTags, invalidateTagDiscoveryCache, reconcileTagDiscoveryCacheAfterTraceDelete } from './discovery';

interface FakeTagClientOptions {
  outerCache?: { values: string[]; refreshedAt: Date } | null;
  lockedCache?: { values: string[]; refreshedAt: Date } | null;
  cursors?: Record<string, string>;
  tagsByTable?: Record<string, { values: string[]; xactId: string | null; cursorId: string | null }>;
  advisoryLockError?: Error;
}

function createFakeTagClient(options: FakeTagClientOptions = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('pg_advisory_xact_lock') && options.advisoryLockError) throw options.advisoryLockError;
    return { rows: [], rowCount: 0 };
  });
  const one = vi.fn(async (sql: string) => {
    if (sql.includes('pg_snapshot_xmin')) return { xactId: '100' };

    for (const table of [TABLE_SPAN_EVENTS, TABLE_METRIC_EVENTS, TABLE_LOG_EVENTS]) {
      if (sql.includes(`"${table}"`)) {
        return options.tagsByTable?.[table] ?? { values: [], xactId: null, cursorId: null };
      }
    }

    throw new Error(`Unexpected one() query: ${sql}`);
  });
  const oneOrNone = vi.fn(async () => options.lockedCache ?? null);
  const manyOrNone = vi.fn(async () =>
    Object.entries(options.cursors ?? {}).map(([cacheKey, cursor]) => ({ cacheKey, values: [cursor] })),
  );
  const tx = { query, one, oneOrNone, manyOrNone } as unknown as TxClient;
  const client = {
    oneOrNone: vi.fn(async () => options.outerCache ?? null),
    tx: vi.fn(async callback => callback(tx)),
    none: vi.fn(async () => null),
  } as unknown as DbClient;

  return { client, tx: { query, one, oneOrNone, manyOrNone } };
}

describe('Postgres observability tag discovery', () => {
  describe('when the cache has no cursor state', () => {
    it('reads each signal through the safe cursor range and stores values with three cursors', async () => {
      const { client, tx } = createFakeTagClient({
        tagsByTable: {
          [TABLE_SPAN_EVENTS]: { values: ['shared', 'z-tag'], xactId: '10', cursorId: '3' },
          [TABLE_METRIC_EVENTS]: { values: ['a-tag', 'shared'], xactId: '11', cursorId: '4' },
          [TABLE_LOG_EVENTS]: { values: [], xactId: null, cursorId: null },
        },
      });

      await expect(getTags(client, 'test_schema', {}, { ttlSeconds: 0 })).resolves.toEqual({
        tags: ['a-tag', 'shared', 'z-tag'],
      });

      const signalQueries = tx.one.mock.calls.filter(([sql]) => sql.includes('WITH new_rows AS MATERIALIZED'));
      expect(signalQueries).toHaveLength(3);
      for (const [sql, params] of signalQueries) {
        expect(sql).toContain('("xactId", "cursorId") > ($1::xid8, $2::bigint)');
        expect(sql).toContain('"xactId" < $3::xid8');
        expect(params).toEqual(['0', '0', '100']);
      }

      const upserts = tx.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO'));
      expect(upserts).toHaveLength(4);
      expect(upserts.map(([, values]) => values?.[0])).toEqual([
        'tags',
        `tags:cursor:${TABLE_SPAN_EVENTS}`,
        `tags:cursor:${TABLE_METRIC_EVENTS}`,
        `tags:cursor:${TABLE_LOG_EVENTS}`,
      ]);
    });
  });

  describe('when another process refreshes while this caller waits for the advisory lock', () => {
    it('keeps the stale-while-revalidate response and skips redundant signal reads', async () => {
      const { client, tx } = createFakeTagClient({
        outerCache: { values: ['stale-tag'], refreshedAt: new Date(0) },
        lockedCache: { values: ['fresh-tag'], refreshedAt: new Date() },
      });

      await expect(getTags(client, 'test_schema', {}, { ttlSeconds: 300 })).resolves.toEqual({ tags: ['stale-tag'] });

      await vi.waitFor(() => {
        expect(tx.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), ['test_schema:tags']);
      });
      expect(tx.query.mock.calls.slice(0, 2)).toEqual([
        [`SET LOCAL lock_timeout = '5s'`],
        [expect.stringContaining('pg_advisory_xact_lock'), ['test_schema:tags']],
      ]);
      expect(tx.one).not.toHaveBeenCalled();
      expect(tx.manyOrNone).not.toHaveBeenCalled();
    });

    it('falls back to cached values when the advisory lock times out', async () => {
      const staleCache = { values: ['stale-tag'], refreshedAt: new Date(0) };
      const lockError = new Error('canceling statement due to lock timeout');
      const warn = vi.fn();
      const logger = { warn } as unknown as IMastraLogger;
      const { client } = createFakeTagClient({
        outerCache: staleCache,
        advisoryLockError: lockError,
      });

      await expect(getTags(client, 'test_schema', {}, { ttlSeconds: 0, logger })).resolves.toEqual({
        tags: ['stale-tag'],
      });
      expect(warn).toHaveBeenCalledWith(
        '[observability/v-next] background refresh failed for discovery cache key "tags"',
        { error: lockError },
      );
    });
  });

  describe('when all signal cursors are present', () => {
    it('starts after each cursor and merges newly discovered tags with cached values', async () => {
      const cursorValues = {
        [`tags:cursor:${TABLE_SPAN_EVENTS}`]: '10:3',
        [`tags:cursor:${TABLE_METRIC_EVENTS}`]: '11:4',
        [`tags:cursor:${TABLE_LOG_EVENTS}`]: '12:5',
      };
      const staleCache = { values: ['cached-tag'], refreshedAt: new Date(0) };
      const { client, tx } = createFakeTagClient({
        outerCache: staleCache,
        lockedCache: staleCache,
        cursors: cursorValues,
        tagsByTable: {
          [TABLE_LOG_EVENTS]: { values: ['new-tag'], xactId: '13', cursorId: '6' },
        },
      });

      await expect(getTags(client, 'test_schema', {}, { ttlSeconds: 0 })).resolves.toEqual({
        tags: ['cached-tag', 'new-tag'],
      });

      const signalQueries = tx.one.mock.calls.filter(([sql]) => sql.includes('WITH new_rows AS MATERIALIZED'));
      expect(signalQueries.map(([, params]) => params?.slice(0, 2))).toEqual([
        ['10', '3'],
        ['11', '4'],
        ['12', '5'],
      ]);
    });
  });

  describe('when signal rows are deleted', () => {
    it('removes only unreferenced tags while preserving discovery cursors', async () => {
      const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
      const manyOrNone = vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('SELECT "cacheKey", "values"')) {
          return [
            { cacheKey: 'tags', values: ['gone-tag', 'shared-tag', 'unaffected-tag'] },
            { cacheKey: `tags:${EntityType.AGENT}`, values: ['gone-tag', 'shared-tag', 'unaffected-tag'] },
          ];
        }
        if (sql.includes('FROM UNNEST')) return [{ value: 'shared-tag' }];
        throw new Error(`Unexpected manyOrNone() query: ${sql}`);
      });
      const tx = { query, manyOrNone } as unknown as TxClient;

      await reconcileTagDiscoveryCacheAfterTraceDelete(tx, 'test_schema', [
        { tags: ['gone-tag', 'shared-tag'], entityType: EntityType.AGENT },
      ]);

      const locks = query.mock.calls.filter(([sql]) => sql.includes('pg_advisory_xact_lock'));
      expect(locks.map(([, params]) => params?.[0])).toEqual([
        'test_schema:tags',
        `test_schema:tags:${EntityType.AGENT}`,
      ]);
      const survivalReads = manyOrNone.mock.calls.filter(([sql]) => sql.includes('FROM UNNEST'));
      expect(survivalReads.map(([, params]) => params)).toEqual([
        [['gone-tag', 'shared-tag']],
        [['gone-tag', 'shared-tag'], EntityType.AGENT],
      ]);
      const updates = query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'));
      expect(updates.map(([, params]) => params)).toEqual([
        ['tags', JSON.stringify(['shared-tag', 'unaffected-tag'])],
        [`tags:${EntityType.AGENT}`, JSON.stringify(['shared-tag', 'unaffected-tag'])],
      ]);
      expect(updates.every(([sql]) => !sql.includes('"refreshedAt"'))).toBe(true);
      expect(query.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(false);
    });

    it('invalidates unscoped, scoped, and cursor tag cache keys', async () => {
      const { client } = createFakeTagClient();

      await invalidateTagDiscoveryCache(client, 'test_schema');

      expect(client.none).toHaveBeenCalledWith(expect.stringContaining(`"cacheKey" LIKE 'tags:%'`));
    });
  });
});
