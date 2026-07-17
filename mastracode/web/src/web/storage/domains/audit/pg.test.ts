import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../../domain';
import { AUDIT_DDL, AuditStoragePG } from './pg';

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
