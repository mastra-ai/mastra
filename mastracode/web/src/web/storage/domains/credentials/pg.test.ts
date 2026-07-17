import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../../domain';
import { MODEL_CREDENTIALS_DDL, ModelCredentialsStoragePG } from './pg';

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
