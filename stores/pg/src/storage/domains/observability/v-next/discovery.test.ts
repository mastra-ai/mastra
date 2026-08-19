import { describe, expect, it, vi } from 'vitest';

import type { DbClient, TxClient } from '../../../client';
import { TABLE_LOG_EVENTS, TABLE_METRIC_EVENTS, TABLE_SPAN_EVENTS } from './ddl';
import { getTags, invalidateTagDiscoveryCache } from './discovery';

interface FakeTagClientOptions {
  outerCache?: { values: string[]; refreshedAt: Date } | null;
  lockedCache?: { values: string[]; refreshedAt: Date } | null;
  cursors?: Record<string, string>;
  tagsByTable?: Record<string, { values: string[]; xactId: string | null; cursorId: string | null }>;
}

function createFakeTagClient(options: FakeTagClientOptions = {}) {
  const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
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
      expect(tx.one).not.toHaveBeenCalled();
      expect(tx.manyOrNone).not.toHaveBeenCalled();
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
    it('invalidates unscoped, scoped, and cursor tag cache keys', async () => {
      const { client } = createFakeTagClient();

      await invalidateTagDiscoveryCache(client, 'test_schema');

      expect(client.none).toHaveBeenCalledWith(expect.stringContaining(`"cacheKey" LIKE 'tags:%'`));
    });
  });
});
