import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../../domain';
import { WORK_ITEMS_DDL, WorkItemsStoragePG } from './pg';

interface RecordedQuery {
  text: string;
  values?: unknown[];
}

type Responder = (text: string, values?: unknown[]) => { rows: any[] } | undefined;

function fakePool(respond: Responder = () => undefined) {
  const queries: RecordedQuery[] = [];
  const run = async (text: string, values?: unknown[]) => {
    queries.push({ text, values });
    return respond(text, values) ?? { rows: [] };
  };
  const pool = {
    query: run,
    connect: async () => ({ query: run, release: () => {} }),
  };
  return { pool, queries, ctx: { pool } as unknown as FactoryStorageContext };
}

const sqlOf = (query: RecordedQuery) => query.text.replace(/\s+/g, ' ').trim();

describe('WorkItemsStoragePG', () => {
  const dbRow = {
    id: 'wi-1',
    org_id: 'org1',
    created_by: 'u1',
    github_project_id: 'p1',
    source: 'github-issue',
    source_key: 'github-issue:42',
    title: 'Fix login',
    url: null,
    stages: ['intake'],
    stage_history: [{ stage: 'intake', enteredAt: '2026-07-01T10:00:00.000Z', by: 'u1' }],
    sessions: {},
    metadata: {},
    created_at: new Date('2026-07-01T10:00:00Z'),
    updated_at: new Date('2026-07-01T10:00:00Z'),
  };

  const createInput = {
    source: 'github-issue' as const,
    sourceKey: 'github-issue:42',
    title: 'Fix login',
    url: null,
    stages: ['intake'],
    sessions: {},
    metadata: {},
  };

  it('runs its DDL on init and inserts fresh items with server-stamped history', async () => {
    const { queries, ctx } = fakePool(text => {
      if (text.includes('FOR UPDATE')) return { rows: [] };
      if (text.includes('INSERT INTO work_items')) return { rows: [dbRow] };
      return undefined;
    });
    const domain = new WorkItemsStoragePG();
    await domain.init(ctx);
    expect(queries[0]!.text).toBe(WORK_ITEMS_DDL);
    expect(WORK_ITEMS_DDL).toContain('ON work_items (org_id, github_project_id, source_key)');
    expect(WORK_ITEMS_DDL).toContain('DROP INDEX IF EXISTS work_items_project_source_key_unique');

    const result = await domain.upsert({ orgId: 'org1', userId: 'u1', githubProjectId: 'p1', input: createInput });
    expect(result.created).toBe(true);
    expect(result.item.sourceKey).toBe('github-issue:42');

    const insert = queries.find(q => q.text.includes('INSERT INTO work_items'))!;
    const history = JSON.parse(insert.values![8] as string);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ stage: 'intake', by: 'u1' });
  });

  it('updates inside a transaction with the row locked FOR UPDATE', async () => {
    const updatedRow = { ...dbRow, stages: ['execute'], updated_at: new Date('2026-07-02T10:00:00Z') };
    const { queries, ctx } = fakePool(text => {
      if (text.includes('FOR UPDATE')) return { rows: [dbRow] };
      if (text.startsWith('UPDATE work_items')) return { rows: [updatedRow] };
      return undefined;
    });
    const domain = new WorkItemsStoragePG();
    await domain.init(ctx);

    const result = await domain.update('org1', 'wi-1', 'u2', { stages: ['execute'] });
    expect(result).not.toBeNull();
    expect(result!.item.stages).toEqual(['execute']);
    expect(result!.previous).toEqual({ stages: ['intake'], sessionRoles: [] });

    const texts = queries.slice(1).map(sqlOf);
    expect(texts[0]).toBe('BEGIN');
    expect(texts[1]).toContain('FOR UPDATE');
    expect(texts[2]).toMatch(/^UPDATE work_items SET/);
    expect(texts[3]).toBe('COMMIT');

    // The stage move was diffed into history by the acting user.
    const update = queries.find(q => q.text.startsWith('UPDATE work_items'))!;
    const historyParam = update.values!.find(
      v => typeof v === 'string' && (v as string).includes('"stage":"execute"'),
    ) as string;
    const history = JSON.parse(historyParam);
    expect(history).toEqual([
      expect.objectContaining({ stage: 'intake', exitedAt: expect.any(String) }),
      expect.objectContaining({ stage: 'execute', by: 'u2' }),
    ]);
  });

  it('rolls back and rethrows when the locked update fails', async () => {
    const { queries, ctx } = fakePool(text => {
      if (text.includes('FOR UPDATE')) throw new Error('boom');
      return undefined;
    });
    const domain = new WorkItemsStoragePG();
    await domain.init(ctx);
    await expect(domain.update('org1', 'wi-1', 'u1', { title: 'x' })).rejects.toThrow('boom');
    expect(queries.map(sqlOf)).toContain('ROLLBACK');
  });

  it('falls back to the existing row when a concurrent insert wins the unique-index race', async () => {
    let selects = 0;
    const { queries, ctx } = fakePool(text => {
      if (text.includes('FOR UPDATE')) {
        // First reuse probe misses; the post-conflict probe finds the winner.
        selects += 1;
        return { rows: selects === 1 ? [] : [dbRow] };
      }
      if (text.includes('INSERT INTO work_items')) throw new Error('duplicate key value violates unique constraint');
      if (text.startsWith('UPDATE work_items')) return { rows: [dbRow] };
      return undefined;
    });
    const domain = new WorkItemsStoragePG();
    await domain.init(ctx);

    const result = await domain.upsert({ orgId: 'org1', userId: 'u1', githubProjectId: 'p1', input: createInput });
    expect(result.created).toBe(false);
    const lockQueries = queries.filter(query => query.text.includes('FOR UPDATE'));
    expect(lockQueries).toHaveLength(2);
    expect(lockQueries[0]!.values).toEqual(['org1', 'p1', 'github-issue:42']);
  });

  it('deletes scoped to the org and returns null on a miss', async () => {
    const { queries, ctx } = fakePool(text => (text.startsWith('DELETE') ? { rows: [] } : undefined));
    const domain = new WorkItemsStoragePG();
    await domain.init(ctx);
    expect(await domain.delete('org1', 'wi-9')).toBeNull();
    expect(queries.at(-1)!.values).toEqual(['wi-9', 'org1']);
  });
});
