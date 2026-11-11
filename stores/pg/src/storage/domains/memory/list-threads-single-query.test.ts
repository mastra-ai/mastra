import type { StorageThreadType } from '@mastra/core/memory';
import type { QueryResult } from 'pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PoolAdapter } from '../../client';
import type { QueryValues } from '../../client';
import { connectionString } from '../../test-utils';
import { MemoryPG } from './index';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const SCHEMA_NAME = 'list_threads_single_query';

/** Reads go through the real pool; every statement sent to Postgres is recorded. */
class RecordingPoolAdapter extends PoolAdapter {
  statements: string[] = [];

  override async one<T = any>(query: string, values?: QueryValues): Promise<T> {
    this.statements.push(query);
    return super.one<T>(query, values);
  }

  override async oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null> {
    this.statements.push(query);
    return super.oneOrNone<T>(query, values);
  }

  // manyOrNone delegates to any, so recording here counts each statement once.
  override async any<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    this.statements.push(query);
    return super.any<T>(query, values);
  }

  override async many<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    this.statements.push(query);
    return super.many<T>(query, values);
  }

  override async query(query: string, values?: QueryValues): Promise<QueryResult> {
    this.statements.push(query);
    return super.query(query, values);
  }
}

const RESOURCE_A = 'resource-a';
const RESOURCE_B = 'resource-b';

function thread(index: number, resourceId: string, metadata: Record<string, unknown>): StorageThreadType {
  const createdAt = new Date(Date.UTC(2025, 0, 1, 0, index));
  // updatedAt runs in the opposite order so ordering by it is distinguishable from createdAt.
  const updatedAt = new Date(Date.UTC(2025, 1, 1, 0, 100 - index));
  return { id: `thread-${index}`, resourceId, title: `Thread ${index}`, metadata, createdAt, updatedAt };
}

const FIXTURE: StorageThreadType[] = [
  thread(1, RESOURCE_A, { channel: 'slack', externalId: 'e1' }),
  thread(2, RESOURCE_A, { channel: 'slack', externalId: 'e2' }),
  thread(3, RESOURCE_A, { channel: 'discord', externalId: 'e1' }),
  thread(4, RESOURCE_A, { channel: 'slack', externalId: 'e3', extra: { nested: true } }),
  thread(5, RESOURCE_B, { channel: 'slack', externalId: 'e1' }),
  thread(6, RESOURCE_B, { channel: 'slack', externalId: 'e4' }),
  thread(7, RESOURCE_B, { channel: 'discord', externalId: 'e5' }),
];

type Filter = { resourceId?: string; metadata?: Record<string, unknown> };
type OrderBy = { field: 'createdAt' | 'updatedAt'; direction: 'ASC' | 'DESC' };

const FILTERS: { name: string; filter?: Filter }[] = [
  { name: 'no filter' },
  { name: 'resourceId', filter: { resourceId: RESOURCE_A } },
  { name: 'one metadata key', filter: { metadata: { channel: 'slack' } } },
  { name: 'two metadata keys', filter: { metadata: { channel: 'slack', externalId: 'e1' } } },
  { name: 'resourceId and metadata', filter: { resourceId: RESOURCE_B, metadata: { channel: 'slack' } } },
  { name: 'no matches', filter: { metadata: { channel: 'teams' } } },
];

const ORDERS: (OrderBy | undefined)[] = [undefined, { field: 'updatedAt', direction: 'ASC' }];

/** The rows listThreads returned before this change, derived straight from the fixture. */
function expectedMatches(filter: Filter | undefined, orderBy: OrderBy | undefined) {
  const field = orderBy?.field ?? 'createdAt';
  const sign = (orderBy?.direction ?? 'DESC') === 'ASC' ? 1 : -1;
  return FIXTURE.filter(
    t =>
      (!filter?.resourceId || t.resourceId === filter.resourceId) &&
      Object.entries(filter?.metadata ?? {}).every(([key, value]) => t.metadata?.[key] === value),
  ).sort((a, b) => sign * (a[field].getTime() - b[field].getTime() || a.id.localeCompare(b.id)));
}

describe('MemoryPG.listThreads against real Postgres', () => {
  let pool: Pool;
  let readClient: RecordingPoolAdapter;
  let store: MemoryPG;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA_NAME} CASCADE`);
    readClient = new RecordingPoolAdapter(pool);
    store = new MemoryPG({ client: new PoolAdapter(pool), readClient, schemaName: SCHEMA_NAME });
    await store.init();
    for (const t of FIXTURE) {
      await store.saveThread({ thread: t });
    }
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA_NAME} CASCADE`);
    await pool.end();
  });

  for (const { name, filter } of FILTERS) {
    for (const orderBy of ORDERS) {
      const label = `${name}, ${orderBy ? `${orderBy.field} ${orderBy.direction}` : 'default order'}`;

      it(`returns every match with perPage false (${label})`, async () => {
        const matches = expectedMatches(filter, orderBy);
        const result = await store.listThreads({ perPage: false, filter, orderBy });
        expect(result).toEqual({ threads: matches, total: matches.length, page: 0, perPage: false, hasMore: false });
      });

      it(`returns the real total and no rows with perPage 0 (${label})`, async () => {
        const matches = expectedMatches(filter, orderBy);
        for (const page of [0, 1]) {
          const result = await store.listThreads({ page, perPage: 0, filter, orderBy });
          expect(result).toEqual({ threads: [], total: matches.length, page, perPage: 0, hasMore: matches.length > 0 });
        }
      });

      for (const perPage of [1, 2, 3, 100]) {
        it(`walks every page and one past the end with perPage ${perPage} (${label})`, async () => {
          const matches = expectedMatches(filter, orderBy);
          const lastPage = Math.ceil(matches.length / perPage);
          for (let page = 0; page <= lastPage + 1; page++) {
            const offset = page * perPage;
            const result = await store.listThreads({ page, perPage, filter, orderBy });
            expect(result).toEqual({
              threads: matches.slice(offset, offset + perPage),
              total: matches.length,
              page,
              perPage,
              hasMore: offset + perPage < matches.length,
            });
          }
        });
      }
    }
  }

  describe('statements sent to Postgres', () => {
    async function statementsFor(args: Parameters<MemoryPG['listThreads']>[0]) {
      readClient.statements = [];
      const result = await store.listThreads(args);
      return { result, statements: readClient.statements };
    }

    it('reads a non-empty page with one statement', async () => {
      for (const filter of [
        undefined,
        { resourceId: RESOURCE_A },
        { metadata: { channel: 'slack', externalId: 'e1' } },
      ]) {
        for (const page of [0, 1]) {
          const { result, statements } = await statementsFor({ page, perPage: 1, filter });
          expect(result.threads).toHaveLength(1);
          expect(statements).toHaveLength(1);
        }
      }
    });

    it('reads a channel lookup by metadata with one statement', async () => {
      const filter = { resourceId: RESOURCE_B, metadata: { channel: 'slack', externalId: 'e1' } };
      for (const perPage of [1, 10]) {
        const { result, statements } = await statementsFor({ page: 0, perPage, filter });
        expect(result.threads.map(t => t.id)).toEqual(['thread-5']);
        expect(statements).toHaveLength(1);
      }
    });

    it('does not count when perPage is false', async () => {
      const { result, statements } = await statementsFor({
        perPage: false,
        filter: { metadata: { channel: 'slack' } },
      });
      expect(result.total).toBe(5);
      expect(statements).toHaveLength(1);
      expect(statements[0]).not.toMatch(/COUNT\(/i);
    });

    it('reads an empty first page with one statement', async () => {
      const { result, statements } = await statementsFor({
        page: 0,
        perPage: 10,
        filter: { metadata: { channel: 'teams' } },
      });
      expect(result.total).toBe(0);
      expect(statements).toHaveLength(1);
    });

    it('counts separately only for a page past the end', async () => {
      const { result, statements } = await statementsFor({ page: 5, perPage: 10, filter: { resourceId: RESOURCE_A } });
      expect(result).toMatchObject({ threads: [], total: 4, hasMore: false });
      expect(statements).toHaveLength(2);
      expect(statements[1]).toMatch(/^SELECT COUNT\(\*\)/);
    });
  });
});
