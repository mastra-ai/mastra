import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../../storage/domain';
import { LINEAR_DDL, LinearStoragePG } from './pg';

function fakeContext() {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const pool = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      return { rows: [] };
    },
  };
  return { queries, ctx: { pool } as unknown as FactoryStorageContext };
}

describe('LinearStoragePG', () => {
  it('runs the complete idempotent DDL during init', async () => {
    const { queries, ctx } = fakeContext();
    const storage = new LinearStoragePG();

    await storage.init(ctx);

    expect(queries).toEqual([{ text: LINEAR_DDL, values: undefined }]);
    expect(LINEAR_DDL).toContain('CREATE TABLE IF NOT EXISTS linear_connections');
    expect(LINEAR_DDL).toContain('ALTER TABLE linear_connections ADD COLUMN IF NOT EXISTS scope text');
    expect(LINEAR_DDL).toContain('CREATE UNIQUE INDEX IF NOT EXISTS linear_connections_org_unique');
  });

  it('refuses queries before init succeeds', async () => {
    const storage = new LinearStoragePG();
    await expect(storage.getConnection('org1')).rejects.toThrow(/Not initialized/);
  });
});
