import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../../domain';
import { DEFAULT_QUEUE_HEALTH_CONFIG } from './base';
import { QUEUE_HEALTH_DDL, QueueHealthStoragePG } from './pg';

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

describe('QueueHealthStoragePG', () => {
  it('runs its DDL on init', async () => {
    const { queries, ctx } = fakePool();
    const domain = new QueueHealthStoragePG();
    await domain.init(ctx);
    expect(queries[0]!.text).toBe(QUEUE_HEALTH_DDL);
  });

  it('returns the stored config value from a row, and the default when no row exists', async () => {
    const stored = { thresholdsSeconds: [5, 50, 500] };
    const { queries, ctx } = fakePool(text =>
      text.includes('FROM queue_health_settings') ? { rows: [{ config: stored }] } : undefined,
    );
    const domain = new QueueHealthStoragePG();
    await domain.init(ctx);

    // Returns the actual stored value, not just the default.
    expect(await domain.getConfig('org1', 'proj1')).toEqual(stored);

    const select = queries.at(-1)!;
    expect(sqlOf(select)).toContain('WHERE org_id = $1 AND github_project_id = $2');
    expect(select.values).toEqual(['org1', 'proj1']);
  });

  it('falls back to the default config on empty rows', async () => {
    const { ctx } = fakePool(() => ({ rows: [] }));
    const domain = new QueueHealthStoragePG();
    await domain.init(ctx);
    expect(await domain.getConfig('org1', 'proj1')).toEqual(DEFAULT_QUEUE_HEALTH_CONFIG);
  });

  it('upserts ON CONFLICT (org_id, github_project_id) on saveConfig', async () => {
    const { queries, ctx } = fakePool();
    const domain = new QueueHealthStoragePG();
    await domain.init(ctx);

    await domain.saveConfig('org1', 'proj1', { thresholdsSeconds: [60, 300, 3600] });

    const upsert = queries.at(-1)!;
    const sql = sqlOf(upsert);
    expect(sql).toContain('INSERT INTO queue_health_settings (org_id, github_project_id, config)');
    expect(sql).toContain('ON CONFLICT (org_id, github_project_id) DO UPDATE');
    expect(upsert.values).toEqual(['org1', 'proj1', JSON.stringify({ thresholdsSeconds: [60, 300, 3600] })]);
  });

  it('rejects non-ascending thresholds on saveConfig', async () => {
    const { queries, ctx } = fakePool();
    const domain = new QueueHealthStoragePG();
    await domain.init(ctx);
    await expect(domain.saveConfig('org1', 'proj1', { thresholdsSeconds: [300, 60] })).rejects.toThrow(
      /strictly ascending/,
    );
    // Only the DDL ran — the invalid write never reached the database.
    expect(queries).toHaveLength(1);
  });
});
