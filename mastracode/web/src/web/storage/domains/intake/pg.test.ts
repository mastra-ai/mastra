import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../../domain';
import { INTAKE_DDL, IntakeStoragePG } from './pg';

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
    const stored = { github: { enabled: false, repositoryIds: ['gp-1'] }, linear: { enabled: true, projectIds: null } };
    let hasRow = false;
    const { ctx } = fakePool(text => {
      if (text.startsWith('SELECT config')) return { rows: hasRow ? [{ config: stored }] : [] };
      return undefined;
    });
    const domain = new IntakeStoragePG();
    await domain.init(ctx);

    expect(await domain.getConfig('org1', 'u1')).toEqual({
      github: { enabled: true, repositoryIds: null },
      linear: { enabled: true, projectIds: null },
    });
    hasRow = true;
    expect(await domain.getConfig('org1', 'u1')).toEqual(stored);
  });

  it('upserts on (org_id, user_id) with the config serialized as jsonb', async () => {
    const { queries, ctx } = fakePool();
    const domain = new IntakeStoragePG();
    await domain.init(ctx);
    const config = { github: { enabled: true, repositoryIds: null }, linear: { enabled: false, projectIds: ['lp-1'] } };
    await domain.saveConfig('org1', 'u1', config);

    const upsert = queries.at(-1)!;
    expect(sqlOf(upsert)).toContain('ON CONFLICT (org_id, user_id)');
    expect(upsert.values).toEqual(['org1', 'u1', JSON.stringify(config)]);
  });

  it('returns defaults for malformed JSON and prerelease github.projectIds rows', async () => {
    const cases: unknown[] = [
      { github: { enabled: true, projectIds: ['old-1'] }, linear: { enabled: true, projectIds: null } },
      { not: 'intake' },
      null,
    ];
    for (const stored of cases) {
      const { ctx } = fakePool(text => {
        if (text.startsWith('SELECT config')) return { rows: [{ config: stored }] };
        return undefined;
      });
      const domain = new IntakeStoragePG();
      await domain.init(ctx);
      const config = await domain.getConfig('org1', 'u1');
      expect(config).toEqual({
        github: { enabled: true, repositoryIds: null },
        linear: { enabled: true, projectIds: null },
      });
      expect(config.github).not.toHaveProperty('projectIds');
    }
  });
});
