import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../../storage/domain';
import { GITHUB_DDL, GithubStoragePG } from './pg';

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

describe('GithubStoragePG', () => {
  it('runs the complete idempotent DDL during init', async () => {
    const { queries, ctx } = fakeContext();
    const storage = new GithubStoragePG();

    await storage.init(ctx);

    expect(queries).toEqual([{ text: GITHUB_DDL, values: undefined }]);
    expect(GITHUB_DDL).toContain('CREATE TABLE IF NOT EXISTS github_installations');
    expect(GITHUB_DDL).toContain('CREATE TABLE IF NOT EXISTS github_projects');
    expect(GITHUB_DDL).toContain('CREATE TABLE IF NOT EXISTS github_project_sandboxes');
    expect(GITHUB_DDL).toContain('CREATE TABLE IF NOT EXISTS github_worktrees');
    expect(GITHUB_DDL).toContain('CREATE TABLE IF NOT EXISTS github_signal_subscriptions');
    expect(GITHUB_DDL).toContain('CREATE UNIQUE INDEX IF NOT EXISTS github_installations_org_installation_unique');
    expect(GITHUB_DDL).toContain('CREATE UNIQUE INDEX IF NOT EXISTS github_signal_subscriptions_target_pr_unique');
  });

  it('refuses queries before init succeeds', async () => {
    const storage = new GithubStoragePG();
    await expect(storage.listInstallations('org1')).rejects.toThrow(/Not initialized/);
  });
});
