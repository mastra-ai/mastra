/**
 * Unit tests for the Postgres factory-storage domain implementations, driven
 * through a fake `pg.Pool` (the same fake-db approach as
 * `github/subscriptions.test.ts`): DDL-on-init, parameter binding + jsonb
 * serialization, snake→camel row mapping, and transaction ordering.
 */

import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../domain';
import { AUDIT_DDL, AuditStoragePG } from './audit/pg';
import { INTAKE_DDL, IntakeStoragePG } from './intake/pg';
import { WORK_ITEMS_DDL, WorkItemsStoragePG } from './work-items/pg';

interface RecordedQuery {
  text: string;
  values?: unknown[];
}

type Responder = (text: string, values?: unknown[]) => { rows: any[] } | undefined;

/** Fake pg.Pool: records every query and answers via the responder. */
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

const sqlOf = (q: RecordedQuery) => q.text.replace(/\s+/g, ' ').trim();

describe('IntakeStoragePG', () => {
  it('runs its DDL on init and refuses queries before init succeeds', async () => {
    const { pool, queries, ctx } = fakePool();
    const domain = new IntakeStoragePG();
    await expect(domain.getConfig('org1', 'u1')).rejects.toThrow(/Not initialized/);
    await domain.init(ctx);
    expect(queries[0]!.text).toBe(INTAKE_DDL);
    expect(pool).toBeDefined();
  });

  it('returns the defaults when no row exists and the stored config otherwise', async () => {
    const stored = { github: { enabled: false, projectIds: ['gp-1'] }, linear: { enabled: true, projectIds: null } };
    let hasRow = false;
    const { ctx } = fakePool(text => {
      if (text.startsWith('SELECT config')) return { rows: hasRow ? [{ config: stored }] : [] };
      return undefined;
    });
    const domain = new IntakeStoragePG();
    await domain.init(ctx);

    expect(await domain.getConfig('org1', 'u1')).toEqual({
      github: { enabled: true, projectIds: null },
      linear: { enabled: true, projectIds: null },
    });
    hasRow = true;
    expect(await domain.getConfig('org1', 'u1')).toEqual(stored);
  });

  it('upserts on (org_id, user_id) with the config serialized as jsonb', async () => {
    const { queries, ctx } = fakePool();
    const domain = new IntakeStoragePG();
    await domain.init(ctx);
    const config = { github: { enabled: true, projectIds: null }, linear: { enabled: false, projectIds: ['lp-1'] } };
    await domain.saveConfig('org1', 'u1', config);

    const upsert = queries.at(-1)!;
    expect(sqlOf(upsert)).toContain('ON CONFLICT (org_id, user_id)');
    expect(upsert.values).toEqual(['org1', 'u1', JSON.stringify(config)]);
  });
});

describe('AuditStoragePG', () => {
  const dbRow = {
    id: 'e1',
    org_id: 'org1',
    actor_id: 'u1',
    actor_type: 'human',
    action: 'factory.run.started',
    targets: [{ type: 'work_item', id: 'wi-1' }],
    metadata: {},
    github_project_id: null,
    context: {},
    occurred_at: new Date('2026-07-01T10:00:00Z'),
  };

  it('runs its DDL on init and maps inserted rows snake→camel', async () => {
    const { queries, ctx } = fakePool(text =>
      text.includes('INSERT INTO audit_events') ? { rows: [dbRow] } : undefined,
    );
    const domain = new AuditStoragePG();
    await domain.init(ctx);
    expect(queries[0]!.text).toBe(AUDIT_DDL);

    const row = await domain.record({
      orgId: 'org1',
      actorId: 'u1',
      action: 'factory.run.started',
      targets: [{ type: 'work_item', id: 'wi-1' }],
    });
    expect(row).toMatchObject({ orgId: 'org1', actorId: 'u1', actorType: 'human', githubProjectId: null });
    expect(row.occurredAt).toBeInstanceOf(Date);

    const insert = queries.at(-1)!;
    // jsonb columns are stringified; actorType defaulted server-side.
    expect(insert.values![2]).toBe('human');
    expect(insert.values![4]).toBe(JSON.stringify([{ type: 'work_item', id: 'wi-1' }]));
  });

  it('builds list filters and the keyset cursor into parameterized conditions', async () => {
    const { queries, ctx } = fakePool(text => (text.includes('FROM audit_events') ? { rows: [] } : undefined));
    const domain = new AuditStoragePG();
    await domain.init(ctx);

    await domain.list({
      orgId: 'org1',
      githubProjectId: 'p1',
      actions: ['factory.git.push'],
      actorId: 'u1',
      before: '2026-07-01T10:00:00.000Z_e9',
      limit: 10,
    });

    const list = queries.at(-1)!;
    const sql = sqlOf(list);
    expect(sql).toContain('org_id = $1');
    expect(sql).toContain('github_project_id = $2');
    expect(sql).toContain('action = ANY($3)');
    expect(sql).toContain('actor_id = $4');
    expect(sql).toContain('(occurred_at < $5 OR (occurred_at = $5 AND id < $6))');
    expect(sql).toContain('ORDER BY occurred_at DESC, id DESC');
    expect(list.values).toEqual([
      'org1',
      'p1',
      ['factory.git.push'],
      'u1',
      new Date('2026-07-01T10:00:00.000Z'),
      'e9',
      11, // limit + 1 look-ahead for nextCursor
    ]);
  });

  it('ignores malformed cursors instead of failing the query', async () => {
    const { queries, ctx } = fakePool(text => (text.includes('FROM audit_events') ? { rows: [] } : undefined));
    const domain = new AuditStoragePG();
    await domain.init(ctx);
    await domain.list({ orgId: 'org1', before: 'not-a-cursor' });
    expect(sqlOf(queries.at(-1)!)).not.toContain('occurred_at <');
  });
});

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
    const { ctx } = fakePool(text => {
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
  });

  it('deletes scoped to the org and returns null on a miss', async () => {
    const { queries, ctx } = fakePool(text => (text.startsWith('DELETE') ? { rows: [] } : undefined));
    const domain = new WorkItemsStoragePG();
    await domain.init(ctx);
    expect(await domain.delete('org1', 'wi-9')).toBeNull();
    expect(queries.at(-1)!.values).toEqual(['wi-9', 'org1']);
  });
});
