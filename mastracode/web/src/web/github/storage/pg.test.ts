import { describe, expect, it } from 'vitest';

import type { FactoryStorageContext } from '../../storage/domain';
import { GithubStorageInMemory } from './inmemory';
import { GITHUB_DDL, GithubStoragePG } from './pg';

function fakeContext(respond: (text: string) => unknown[] = () => []) {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const pool = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      return { rows: respond(text) };
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

  it('refreshes the sandbox provider when a project already exists', async () => {
    const dbRow = {
      id: 'project-1',
      org_id: 'org1',
      user_id: 'user1',
      installation_id: '12',
      repo_full_name: 'mastra-ai/mastra',
      repo_id: '34',
      default_branch: 'main',
      sandbox_provider: 'railway',
      sandbox_workdir: '/workspace/mastra',
      setup_command: null,
      created_at: new Date(),
    };
    const { queries, ctx } = fakeContext(text => (text.includes('INSERT INTO github_projects') ? [dbRow] : []));
    const storage = new GithubStoragePG();
    await storage.init(ctx);

    await storage.upsertProject({
      orgId: 'org1',
      userId: 'user1',
      installationId: 12,
      repoFullName: 'mastra-ai/mastra',
      repoId: 34,
      defaultBranch: 'main',
      sandboxProvider: 'railway',
      sandboxWorkdir: '/workspace/mastra',
    });

    expect(queries.at(-1)!.text).toContain('sandbox_provider = EXCLUDED.sandbox_provider');
  });

  it('refreshes the sandbox provider in memory too', async () => {
    const storage = new GithubStorageInMemory();
    const input = {
      orgId: 'org1',
      userId: 'user1',
      installationId: 12,
      repoFullName: 'mastra-ai/mastra',
      repoId: 34,
      defaultBranch: 'main',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace/mastra',
    };
    await storage.upsertProject(input);

    const updated = await storage.upsertProject({ ...input, sandboxProvider: 'railway' });

    expect(updated.sandboxProvider).toBe('railway');
  });

  it('refuses queries before init succeeds', async () => {
    const storage = new GithubStoragePG();
    await expect(storage.listInstallations('org1')).rejects.toThrow(/Not initialized/);
  });
});
