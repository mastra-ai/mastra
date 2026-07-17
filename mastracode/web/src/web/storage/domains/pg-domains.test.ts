/**
 * Unit tests for the Postgres factory-storage domain implementations, driven
 * through a fake `pg.Pool` (the same fake-db approach as
 * `github/subscriptions.test.ts`): DDL-on-init, parameter binding + jsonb
 * serialization, snake→camel row mapping, and transaction ordering.
 */

import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../domain';
import { AUDIT_DDL, AuditStoragePG } from './audit/pg';
import { MODEL_CREDENTIALS_DDL, ModelCredentialsStoragePG } from './credentials/pg';
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

describe('ModelCredentialsStoragePG', () => {
  const oauthCred = { type: 'oauth' as const, access: 'at-1', refresh: 'rt-1', expires: Date.now() + 60_000 };
  const apiKeyCred = { type: 'api_key' as const, key: 'sk-org' };

  it('runs its DDL on init and refuses queries before init succeeds', async () => {
    const { queries, ctx } = fakePool();
    const domain = new ModelCredentialsStoragePG();
    await expect(domain.getCredential({ orgId: 'org1', userId: 'u1' }, 'anthropic')).rejects.toThrow(/Not initialized/);
    await domain.init(ctx);
    expect(queries[0]!.text).toBe(MODEL_CREDENTIALS_DDL);
  });

  it('rejects org-scoped OAuth credentials before issuing an upsert', async () => {
    const { queries, ctx } = fakePool();
    const domain = new ModelCredentialsStoragePG();
    await domain.init(ctx);
    const queryCount = queries.length;

    await expect(domain.setCredential({ orgId: 'org1' }, 'anthropic', oauthCred)).rejects.toThrow(
      'OAuth credentials must be user-scoped',
    );
    expect(queries).toHaveLength(queryCount);
  });

  it('upserts user rows and org rows against their own partial-unique conflict targets', async () => {
    const { queries, ctx } = fakePool();
    const domain = new ModelCredentialsStoragePG();
    await domain.init(ctx);

    await domain.setCredential({ orgId: 'org1', userId: 'u1' }, 'anthropic', oauthCred);
    const userUpsert = sqlOf(queries.at(-1)!);
    expect(userUpsert).toContain('ON CONFLICT (org_id, user_id, provider) WHERE user_id IS NOT NULL');
    expect(queries.at(-1)!.values).toEqual(['org1', 'u1', 'anthropic', 'oauth', JSON.stringify(oauthCred)]);

    await domain.setCredential({ orgId: 'org1' }, 'openai', apiKeyCred);
    const orgUpsert = sqlOf(queries.at(-1)!);
    expect(orgUpsert).toContain('ON CONFLICT (org_id, provider) WHERE user_id IS NULL');
    expect(queries.at(-1)!.values).toEqual(['org1', null, 'openai', 'api_key', JSON.stringify(apiKeyCred)]);
  });

  it('resolves with the user row winning over the org row in one ordered query', async () => {
    const { queries, ctx } = fakePool(text =>
      text.includes('ORDER BY user_id NULLS LAST')
        ? { rows: [{ provider: 'anthropic', user_id: 'u1', data: oauthCred, updated_at: new Date() }] }
        : undefined,
    );
    const domain = new ModelCredentialsStoragePG();
    await domain.init(ctx);

    const resolved = await domain.resolveCredential('org1', 'u1', 'anthropic');
    expect(resolved).toEqual({ provider: 'anthropic', scope: 'user', credential: oauthCred });

    const select = sqlOf(queries.at(-1)!);
    expect(select).toContain('(user_id = $3 OR user_id IS NULL)');
    expect(select).toContain('ORDER BY user_id NULLS LAST');
    expect(select).toContain('LIMIT 1');
  });

  it('maps org rows (user_id NULL) to org scope in list and resolve', async () => {
    const { ctx } = fakePool(text => {
      if (text.includes('ORDER BY user_id NULLS LAST'))
        return { rows: [{ provider: 'openai', user_id: null, data: apiKeyCred, updated_at: new Date() }] };
      if (text.includes('(user_id = $2 OR user_id IS NULL)'))
        return {
          rows: [
            { provider: 'anthropic', user_id: 'u1', data: oauthCred, updated_at: new Date() },
            { provider: 'openai', user_id: null, data: apiKeyCred, updated_at: new Date() },
          ],
        };
      return undefined;
    });
    const domain = new ModelCredentialsStoragePG();
    await domain.init(ctx);

    const resolved = await domain.resolveCredential('org1', 'u1', 'openai');
    expect(resolved).toMatchObject({ scope: 'org', credential: apiKeyCred });

    const listed = await domain.listCredentials('org1', 'u1');
    expect(listed.map(r => [r.provider, r.scope])).toEqual([
      ['anthropic', 'user'],
      ['openai', 'org'],
    ]);
  });

  it('refreshes an expired OAuth row under FOR UPDATE and persists the rotation', async () => {
    const expired = { ...oauthCred, expires: Date.now() - 1000 };
    const { queries, ctx } = fakePool(text => {
      if (text.includes('FOR UPDATE')) return { rows: [{ id: 'row-1', data: expired }] };
      return undefined;
    });
    const domain = new ModelCredentialsStoragePG();
    await domain.init(ctx);

    const rotated = { type: 'oauth' as const, access: 'at-2', refresh: 'rt-2', expires: Date.now() + 60_000 };
    const result = await domain.refreshOAuth({ orgId: 'org1', userId: 'u1' }, 'anthropic', async () => rotated);
    expect(result).toEqual(rotated);

    const texts = queries.slice(1).map(sqlOf);
    expect(texts[0]).toBe('BEGIN');
    expect(texts[1]).toContain('FOR UPDATE');
    expect(texts[2]).toMatch(/^UPDATE model_provider_credentials SET data/);
    expect(texts[3]).toBe('COMMIT');
    const update = queries.find(q => q.text.includes('UPDATE model_provider_credentials'))!;
    expect(update.values).toEqual(['row-1', JSON.stringify(rotated)]);
  });

  it('skips the refresh when the locked row is already fresh (replica raced us)', async () => {
    const { queries, ctx } = fakePool(text => {
      if (text.includes('FOR UPDATE')) return { rows: [{ id: 'row-1', data: oauthCred }] };
      return undefined;
    });
    const domain = new ModelCredentialsStoragePG();
    await domain.init(ctx);

    let called = false;
    const result = await domain.refreshOAuth({ orgId: 'org1', userId: 'u1' }, 'anthropic', async () => {
      called = true;
      return oauthCred;
    });
    expect(result).toEqual(oauthCred);
    expect(called).toBe(false);
    expect(queries.some(q => q.text.includes('UPDATE model_provider_credentials'))).toBe(false);
    expect(queries.map(sqlOf)).toContain('COMMIT');
  });

  it('rolls back and rethrows when the refresh callback fails', async () => {
    const expired = { ...oauthCred, expires: Date.now() - 1000 };
    const { queries, ctx } = fakePool(text => {
      if (text.includes('FOR UPDATE')) return { rows: [{ id: 'row-1', data: expired }] };
      return undefined;
    });
    const domain = new ModelCredentialsStoragePG();
    await domain.init(ctx);

    await expect(
      domain.refreshOAuth({ orgId: 'org1', userId: 'u1' }, 'anthropic', async () => {
        throw new Error('upstream 400');
      }),
    ).rejects.toThrow('upstream 400');
    expect(queries.map(sqlOf)).toContain('ROLLBACK');
  });

  it('persists login sessions as jsonb and deletes expired sessions on read', async () => {
    const now = Date.now();
    const dbSession = {
      session_id: 's-1',
      org_id: 'org1',
      user_id: 'u1',
      provider: 'openai',
      kind: 'device-code',
      pending: { deviceAuthId: 'd-1' },
      expires_at: new Date(now + 60_000),
      next_poll_at: null,
      created_at: new Date(now),
    };
    let expired = false;
    const { queries, ctx } = fakePool(text => {
      if (text.includes('INSERT INTO oauth_login_sessions')) return { rows: [dbSession] };
      if (text.startsWith('SELECT * FROM oauth_login_sessions'))
        return { rows: [{ ...dbSession, expires_at: expired ? new Date(now - 1000) : dbSession.expires_at }] };
      return undefined;
    });
    const domain = new ModelCredentialsStoragePG();
    await domain.init(ctx);

    const created = await domain.createLoginSession({
      sessionId: 's-1',
      orgId: 'org1',
      userId: 'u1',
      provider: 'openai',
      kind: 'device-code',
      pending: { deviceAuthId: 'd-1' },
      expiresAt: dbSession.expires_at,
    });
    expect(created).toMatchObject({ sessionId: 's-1', kind: 'device-code', nextPollAt: null });
    const insert = queries.find(q => q.text.includes('INSERT INTO oauth_login_sessions'))!;
    expect(insert.values![5]).toBe(JSON.stringify({ deviceAuthId: 'd-1' }));

    expect(await domain.getLoginSession('s-1')).toMatchObject({ pending: { deviceAuthId: 'd-1' } });

    expired = true;
    expect(await domain.getLoginSession('s-1')).toBeUndefined();
    expect(queries.at(-1)!.text).toContain('DELETE FROM oauth_login_sessions WHERE expires_at <= now()');
  });

  it('touches only the provided session fields', async () => {
    const { queries, ctx } = fakePool();
    const domain = new ModelCredentialsStoragePG();
    await domain.init(ctx);

    const nextPollAt = new Date();
    await domain.touchLoginSession('s-1', { nextPollAt });
    expect(sqlOf(queries.at(-1)!)).toBe('UPDATE oauth_login_sessions SET next_poll_at = $2 WHERE session_id = $1');
    expect(queries.at(-1)!.values).toEqual(['s-1', nextPollAt]);

    const before = queries.length;
    await domain.touchLoginSession('s-1', {});
    expect(queries.length).toBe(before);
  });
});
