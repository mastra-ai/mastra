import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished } from 'vitest';

import { DEFAULT_INTAKE_CONFIG, IntakeStorage, resolveIntakeLabelRoute } from './base.js';

async function makeStorage(url: string = ':memory:'): Promise<IntakeStorage> {
  const backend = new LibSQLFactoryStorage({ id: 'intake-test', url });
  const domain = backend.registerDomain(new IntakeStorage());
  await backend.init();
  onTestFinished(() => backend.close());
  return domain;
}

describe('IntakeStorage', () => {
  it('returns a fresh empty config for every caller', async () => {
    const storage = await makeStorage();
    const first = await storage.getConfig({ orgId: 'org1' });
    first.github = { enabled: false, sourceIds: null };
    const second = await storage.getConfig({ orgId: 'org1' });

    expect(second).toEqual(DEFAULT_INTAKE_CONFIG);
    expect(second).not.toBe(DEFAULT_INTAKE_CONFIG);
  });

  it('round-trips dynamic integration selections per org', async () => {
    const storage = await makeStorage();
    const config = {
      github: { enabled: true, sourceIds: ['repo-1'] },
      linear: { enabled: false, sourceIds: null },
    };

    await storage.saveConfig({ orgId: 'org1', config });
    expect(await storage.getConfig({ orgId: 'org1' })).toEqual(config);
    expect(await storage.getConfig({ orgId: 'org2' })).toEqual(DEFAULT_INTAKE_CONFIG);

    const updated = { ...config, linear: { enabled: true, sourceIds: ['team-1'] } };
    await storage.saveConfig({ orgId: 'org1', config: updated });
    expect(await storage.getConfig({ orgId: 'org1' })).toEqual(updated);
  });

  it('converges concurrent first saves onto one row', async () => {
    const storage = await makeStorage();
    const a = { github: { enabled: true, sourceIds: ['a'] } };
    const b = { gitlab: { enabled: true, sourceIds: ['b'] } };

    await Promise.all([
      storage.saveConfig({ orgId: 'org1', config: a }),
      storage.saveConfig({ orgId: 'org1', config: b }),
    ]);

    expect([a, b]).toContainEqual(await storage.getConfig({ orgId: 'org1' }));
  });

  it('merges a partial config over the stored selections', async () => {
    const storage = await makeStorage();
    expect(
      await storage.mergeConfig({ orgId: 'org1', config: { github: { enabled: true, sourceIds: ['a'] } } }),
    ).toEqual({
      github: { enabled: true, sourceIds: ['a'] },
    });
    await storage.mergeConfig({ orgId: 'org1', config: { custom: { enabled: false, sourceIds: ['x'] } } });
    await storage.mergeConfig({ orgId: 'org1', config: { github: { enabled: false, sourceIds: null } } });

    expect(await storage.getConfig({ orgId: 'org1' })).toEqual({
      github: { enabled: false, sourceIds: null },
      custom: { enabled: false, sourceIds: ['x'] },
    });
    expect(await storage.getConfig({ orgId: 'org2' })).toEqual(DEFAULT_INTAKE_CONFIG);
  });

  describe('legacy per-member selections', () => {
    // File-backed so a per-member deployment can write rows, close, and a later boot folds them.
    function tempDatabaseUrl(): string {
      const dir = mkdtempSync(join(tmpdir(), 'intake-fold-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      return `file:${join(dir, 'intake.db')}`;
    }

    async function seedLegacyRows(url: string, rows: Array<{ orgId: string; userId: string; config: unknown }>) {
      const backend = new LibSQLFactoryStorage({ id: 'intake-test-legacy', url });
      backend.registerDomain(new IntakeStorage());
      await backend.init();
      const now = new Date();
      try {
        for (const row of rows) {
          await backend.ops.insertOne('intake_settings', {
            org_id: row.orgId,
            user_id: row.userId,
            config: row.config,
            created_at: now,
            updated_at: now,
          });
        }
      } finally {
        await backend.close();
      }
    }

    it('folds what members were syncing into one shared selection at boot, ignoring switched-off picks', async () => {
      const url = tempDatabaseUrl();
      await seedLegacyRows(url, [
        { orgId: 'org1', userId: 'alice', config: { github: { enabled: true, sourceIds: ['acme/app'] } } },
        {
          orgId: 'org1',
          userId: 'bob',
          config: {
            github: { enabled: false, sourceIds: ['acme/site'] },
            linear: { enabled: true, sourceIds: ['proj-1'] },
          },
        },
        { orgId: 'org2', userId: 'alice', config: { github: { enabled: false, sourceIds: null } } },
      ]);

      const storage = await makeStorage(url);

      expect(await storage.getConfig({ orgId: 'org1' })).toEqual({
        github: { enabled: true, sourceIds: ['acme/app'] },
        linear: { enabled: true, sourceIds: ['proj-1'] },
      });
      expect(await storage.getConfig({ orgId: 'org2' })).toEqual({ github: { enabled: false, sourceIds: null } });
    });

    it('does not overwrite a shared selection saved after the fold', async () => {
      const url = tempDatabaseUrl();
      await seedLegacyRows(url, [
        { orgId: 'org1', userId: 'alice', config: { github: { enabled: true, sourceIds: ['acme/app'] } } },
      ]);

      const firstBoot = await makeStorage(url);
      const shared = { github: { enabled: false, sourceIds: null } };
      await firstBoot.saveConfig({ orgId: 'org1', config: shared });

      const secondBoot = await makeStorage(url);
      expect(await secondBoot.getConfig({ orgId: 'org1' })).toEqual(shared);
    });
  });

  describe('source bindings', () => {
    it('scopes bound source ids to one org and Factory project', async () => {
      const storage = await makeStorage();
      await storage.setBinding({
        orgId: 'org1',
        integrationId: 'linear',
        sourceId: 'src-a',
        factoryProjectId: 'proj-1',
        userId: 'user1',
      });
      await storage.setBinding({
        orgId: 'org1',
        integrationId: 'linear',
        sourceId: 'src-b',
        factoryProjectId: 'proj-2',
      });
      await storage.setBinding({
        orgId: 'org2',
        integrationId: 'linear',
        sourceId: 'src-c',
        factoryProjectId: 'proj-1',
      });

      const scope = { orgId: 'org1', integrationId: 'linear' };
      expect(await storage.listBoundSourceIds({ ...scope, factoryProjectId: 'proj-1' })).toEqual(['src-a']);
      expect(await storage.listBoundSourceIds({ ...scope, factoryProjectId: 'proj-2' })).toEqual(['src-b']);
      expect(await storage.listBoundSourceIds({ ...scope, factoryProjectId: 'proj-3' })).toEqual([]);
      expect(await storage.listBindings({ orgId: 'org1' })).toHaveLength(2);
      expect(await storage.listBindings({ orgId: 'org1', integrationId: 'github' })).toEqual([]);
    });

    it('moves a source to another project instead of binding it twice', async () => {
      const storage = await makeStorage();
      const binding = { orgId: 'org1', integrationId: 'linear', sourceId: 'src-a' };

      await storage.setBinding({ ...binding, factoryProjectId: 'proj-1' });
      await storage.setBinding({ ...binding, factoryProjectId: 'proj-2' });

      expect(await storage.listBindings({ orgId: 'org1' })).toEqual([
        {
          integrationId: 'linear',
          sourceId: 'src-a',
          factoryProjectId: 'proj-2',
          board: null,
          labels: null,
          createdAt: expect.any(Date),
        },
      ]);
      expect(await storage.listBoundSourceIds({ ...binding, factoryProjectId: 'proj-1' })).toEqual([]);
    });

    it('persists the bound board and resets it when rebound without one', async () => {
      const storage = await makeStorage();
      const binding = { orgId: 'org1', integrationId: 'linear', sourceId: 'src-a' };

      await storage.setBinding({ ...binding, factoryProjectId: 'proj-1', board: 'release' });
      expect(await storage.getBinding(binding)).toEqual({
        integrationId: 'linear',
        sourceId: 'src-a',
        factoryProjectId: 'proj-1',
        board: 'release',
        labels: null,
        createdAt: expect.any(Date),
      });

      await storage.setBinding({ ...binding, factoryProjectId: 'proj-1' });
      expect((await storage.getBinding(binding))?.board).toBeNull();
      expect(await storage.getBinding({ ...binding, sourceId: 'missing' })).toBeNull();
    });

    it('clears a binding and returns its project', async () => {
      const storage = await makeStorage();
      const binding = { orgId: 'org1', integrationId: 'linear', sourceId: 'src-a' };

      await storage.setBinding({ ...binding, factoryProjectId: 'proj-1' });
      expect(await storage.clearBinding(binding)).toEqual({
        integrationId: 'linear',
        sourceId: 'src-a',
        factoryProjectId: 'proj-1',
        board: null,
        labels: null,
        createdAt: expect.any(Date),
      });

      expect(await storage.clearBinding(binding)).toBeNull();
      expect(await storage.listBindings({ orgId: 'org1' })).toEqual([]);
    });

    it('converges concurrent first bindings onto one row', async () => {
      const storage = await makeStorage();
      const binding = { orgId: 'org1', integrationId: 'linear', sourceId: 'src-a' };

      await Promise.all([
        storage.setBinding({ ...binding, factoryProjectId: 'proj-1' }),
        storage.setBinding({ ...binding, factoryProjectId: 'proj-2' }),
      ]);

      const rows = await storage.listBindings({ orgId: 'org1' });
      expect(rows).toHaveLength(1);
      expect(['proj-1', 'proj-2']).toContain(rows[0]!.factoryProjectId);
    });

    it('atomically migrates and deduplicates equivalent source selections and bindings', async () => {
      const storage = await makeStorage();
      await storage.saveConfig({
        orgId: 'org1',
        config: { gitlab: { enabled: true, sourceIds: ['legacy-a', 'legacy-b', 'canonical'] } },
      });
      for (const sourceId of ['legacy-a', 'legacy-b']) {
        await storage.setBinding({
          orgId: 'org1',
          integrationId: 'gitlab',
          sourceId,
          factoryProjectId: 'proj-1',
          board: 'work',
        });
      }

      await expect(
        storage.migrateSourceIds({
          orgId: 'org1',
          integrationId: 'gitlab',
          migrations: [
            { from: 'legacy-a', to: 'canonical' },
            { from: 'legacy-b', to: 'canonical' },
          ],
        }),
      ).resolves.toMatchObject({ conflicts: [] });
      expect(await storage.getConfig({ orgId: 'org1' })).toEqual({
        gitlab: { enabled: true, sourceIds: ['canonical'] },
      });
      expect(await storage.listBindings({ orgId: 'org1', integrationId: 'gitlab' })).toEqual([
        {
          integrationId: 'gitlab',
          sourceId: 'canonical',
          factoryProjectId: 'proj-1',
          board: 'work',
          labels: null,
          createdAt: expect.any(Date),
        },
      ]);
    });

    it('rejects conflicting canonical routes without changing selection or bindings', async () => {
      const storage = await makeStorage();
      const config = { gitlab: { enabled: true, sourceIds: ['legacy', 'canonical'] } };
      await storage.saveConfig({ orgId: 'org1', config });
      await storage.setBinding({
        orgId: 'org1',
        integrationId: 'gitlab',
        sourceId: 'legacy',
        factoryProjectId: 'proj-1',
        board: 'work',
      });
      await storage.setBinding({
        orgId: 'org1',
        integrationId: 'gitlab',
        sourceId: 'canonical',
        factoryProjectId: 'proj-2',
        board: 'review',
      });

      await expect(
        storage.migrateSourceIds({
          orgId: 'org1',
          integrationId: 'gitlab',
          migrations: [{ from: 'legacy', to: 'canonical' }],
        }),
      ).resolves.toEqual({ migrations: [], conflicts: [{ from: 'legacy', to: 'canonical' }] });
      expect(await storage.getConfig({ orgId: 'org1' })).toEqual(config);
      expect(await storage.listBindings({ orgId: 'org1', integrationId: 'gitlab' })).toHaveLength(2);
    });
  });

  describe('bindings shared by label', () => {
    const source = { orgId: 'org1', integrationId: 'jira', sourceId: 'OPS' };

    it('lets several factories share a source with disjoint label filters', async () => {
      const storage = await makeStorage();
      await expect(
        storage.setSharedBinding({ ...source, factoryProjectId: 'A', board: 'work', labels: null }),
      ).resolves.toEqual({
        conflicts: [],
      });
      await storage.setSharedBinding({
        ...source,
        factoryProjectId: 'B',
        board: 'work',
        labels: [' Payments ', 'payments'],
      });
      await storage.setSharedBinding({ ...source, factoryProjectId: 'C', board: 'work', labels: ['mobile', 'ios'] });

      expect(
        (await storage.listBindings({ orgId: 'org1', integrationId: 'jira' })).map(({ factoryProjectId, labels }) => ({
          factoryProjectId,
          labels,
        })),
      ).toEqual([
        { factoryProjectId: 'A', labels: null },
        // Trimmed and de-duplicated case-insensitively, keeping the spelling the user typed first.
        { factoryProjectId: 'B', labels: ['Payments'] },
        { factoryProjectId: 'C', labels: ['mobile', 'ios'] },
      ]);
    });

    it('rejects a second all-issues binding and overlapping labels without saving them', async () => {
      const storage = await makeStorage();
      await storage.setSharedBinding({ ...source, factoryProjectId: 'A', labels: null });
      await storage.setSharedBinding({ ...source, factoryProjectId: 'B', labels: ['payments', 'billing'] });

      await expect(storage.setSharedBinding({ ...source, factoryProjectId: 'C', labels: null })).resolves.toEqual({
        conflicts: [{ factoryProjectId: 'A', labels: null }],
      });
      await expect(
        storage.setSharedBinding({ ...source, factoryProjectId: 'C', labels: ['PAYMENTS', 'mobile'] }),
      ).resolves.toEqual({ conflicts: [{ factoryProjectId: 'B', labels: ['payments'] }] });
      expect(await storage.getBinding({ ...source, factoryProjectId: 'C' })).toBeNull();

      // A label filter alongside the all-issues binding is not a conflict: labels take precedence.
      await expect(storage.setSharedBinding({ ...source, factoryProjectId: 'C', labels: ['mobile'] })).resolves.toEqual(
        {
          conflicts: [],
        },
      );
    });

    it("edits a factory's own binding in place and keeps its precedence", async () => {
      const storage = await makeStorage();
      await storage.setSharedBinding({ ...source, factoryProjectId: 'B', labels: ['payments'] });
      const created = (await storage.getBinding({ ...source, factoryProjectId: 'B' }))!.createdAt;
      await storage.setSharedBinding({ ...source, factoryProjectId: 'C', labels: ['mobile'] });

      await storage.setSharedBinding({
        ...source,
        factoryProjectId: 'B',
        board: 'release',
        labels: ['payments', 'refunds'],
      });

      const bindings = await storage.listBindings({ orgId: 'org1', integrationId: 'jira' });
      expect(bindings).toHaveLength(2);
      expect(bindings[0]).toMatchObject({ factoryProjectId: 'B', board: 'release', labels: ['payments', 'refunds'] });
      expect(bindings[0]!.createdAt).toEqual(created);
    });

    it('lets only one of two concurrent conflicting saves win', async () => {
      const storage = await makeStorage();
      const results = await Promise.all([
        storage.setSharedBinding({ ...source, factoryProjectId: 'A', labels: null }),
        storage.setSharedBinding({ ...source, factoryProjectId: 'B', labels: null }),
        storage.setSharedBinding({ ...source, factoryProjectId: 'C', labels: ['payments'] }),
        storage.setSharedBinding({ ...source, factoryProjectId: 'D', labels: ['Payments'] }),
      ]);

      expect(results.filter(result => result.conflicts.length === 0)).toHaveLength(2);
      const bindings = await storage.listBindings({ orgId: 'org1', integrationId: 'jira' });
      expect(bindings.filter(binding => binding.labels === null)).toHaveLength(1);
      expect(bindings.filter(binding => binding.labels !== null)).toHaveLength(1);
    });

    it("removes one factory's binding and leaves the others", async () => {
      const storage = await makeStorage();
      await storage.setSharedBinding({ ...source, factoryProjectId: 'A', labels: null });
      await storage.setSharedBinding({ ...source, factoryProjectId: 'B', labels: ['payments'] });

      expect(await storage.clearBinding({ ...source, factoryProjectId: 'B' })).toMatchObject({
        factoryProjectId: 'B',
        labels: ['payments'],
      });
      expect(await storage.clearBinding({ ...source, factoryProjectId: 'B' })).toBeNull();
      expect(await storage.listBindings({ orgId: 'org1' })).toEqual([
        expect.objectContaining({ factoryProjectId: 'A', labels: null }),
      ]);
    });
  });

  describe('bindings saved before label filters', () => {
    function tempDatabaseUrl(): string {
      const dir = mkdtempSync(join(tmpdir(), 'intake-bindings-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      return `file:${join(dir, 'intake.db')}`;
    }

    const legacyCreatedAt = new Date('2026-03-01T00:00:00Z');

    /** A database as an earlier build left it: bindings only in `intake_source_bindings`, nothing copied yet. */
    async function seedLegacyBindings(url: string) {
      const backend = new LibSQLFactoryStorage({ id: 'intake-test-legacy-bindings', url });
      backend.registerDomain(new IntakeStorage());
      await backend.init();
      try {
        await backend.ops.deleteMany('intake_source_subscriptions', {});
        await backend.ops.deleteMany('intake_data_migrations', {});
        for (const [integrationId, sourceId, factoryProjectId, board] of [
          ['jira', 'OPS', 'proj-1', 'work'],
          ['linear', 'team-1', 'proj-2', null],
        ] as const) {
          await backend.ops.insertOne('intake_source_bindings', {
            org_id: 'org1',
            integration_id: integrationId,
            source_id: sourceId,
            factory_project_id: factoryProjectId,
            board,
            created_by_user_id: 'alice',
            created_at: legacyCreatedAt,
            updated_at: legacyCreatedAt,
          });
        }
      } finally {
        await backend.close();
      }
    }

    async function legacyRows(url: string) {
      const backend = new LibSQLFactoryStorage({ id: 'intake-test-legacy-read', url });
      backend.registerDomain(new IntakeStorage());
      await backend.init();
      try {
        return await backend.ops.findMany('intake_source_bindings', {});
      } finally {
        await backend.close();
      }
    }

    it('keeps every existing binding as an all-issues binding after upgrade', async () => {
      const url = tempDatabaseUrl();
      await seedLegacyBindings(url);

      const storage = await makeStorage(url);

      expect(await storage.listBindings({ orgId: 'org1' })).toEqual([
        {
          integrationId: 'jira',
          sourceId: 'OPS',
          factoryProjectId: 'proj-1',
          board: 'work',
          labels: null,
          createdAt: legacyCreatedAt,
        },
        {
          integrationId: 'linear',
          sourceId: 'team-1',
          factoryProjectId: 'proj-2',
          board: null,
          labels: null,
          createdAt: legacyCreatedAt,
        },
      ]);
    });

    it('copies once, so a binding removed after upgrade stays removed on the next boot', async () => {
      const url = tempDatabaseUrl();
      await seedLegacyBindings(url);
      const before = await legacyRows(url);

      const firstBoot = await makeStorage(url);
      await firstBoot.clearBinding({
        orgId: 'org1',
        integrationId: 'jira',
        sourceId: 'OPS',
        factoryProjectId: 'proj-1',
      });
      await firstBoot.setSharedBinding({
        orgId: 'org1',
        integrationId: 'jira',
        sourceId: 'OPS',
        factoryProjectId: 'proj-3',
        labels: ['payments'],
      });
      await firstBoot.setBinding({
        orgId: 'org1',
        integrationId: 'linear',
        sourceId: 'team-1',
        factoryProjectId: 'proj-4',
      });

      const secondBoot = await makeStorage(url);
      expect(
        (await secondBoot.listBindings({ orgId: 'org1' })).map(({ sourceId, factoryProjectId, labels }) => ({
          sourceId,
          factoryProjectId,
          labels,
        })),
      ).toEqual([
        { sourceId: 'OPS', factoryProjectId: 'proj-3', labels: ['payments'] },
        { sourceId: 'team-1', factoryProjectId: 'proj-4', labels: null },
      ]);
      // The old collection is left exactly as the earlier build wrote it, for a rollback.
      expect(await legacyRows(url)).toEqual(before);
    });
  });

  describe('label routes', () => {
    const route = { orgId: 'org-1', factoryProjectId: 'proj-1', integrationId: 'github' };

    it('scopes routes to one org and project and sorts them by label', async () => {
      const storage = await makeStorage();
      await storage.setLabelRoute({ ...route, label: 'release', board: 'release' });
      await storage.setLabelRoute({ ...route, label: 'docs', board: 'docs' });
      await storage.setLabelRoute({ ...route, factoryProjectId: 'proj-2', label: 'release', board: 'other' });
      await storage.setLabelRoute({ ...route, orgId: 'org-2', label: 'release', board: 'other' });

      expect(await storage.listLabelRoutes({ orgId: 'org-1', factoryProjectId: 'proj-1' })).toEqual([
        { factoryProjectId: 'proj-1', integrationId: 'github', label: 'docs', board: 'docs' },
        { factoryProjectId: 'proj-1', integrationId: 'github', label: 'release', board: 'release' },
      ]);
      expect(await storage.listLabelRoutes({ orgId: 'org-1' })).toHaveLength(3);
    });

    it('treats labels case-insensitively and updates the board in place', async () => {
      const storage = await makeStorage();
      await storage.setLabelRoute({ ...route, label: 'Release', board: 'release' });
      await storage.setLabelRoute({ ...route, label: 'RELEASE ', board: 'release-2' });

      expect(await storage.listLabelRoutes({ orgId: 'org-1' })).toEqual([
        { factoryProjectId: 'proj-1', integrationId: 'github', label: 'release', board: 'release-2' },
      ]);
      expect(resolveIntakeLabelRoute(await storage.listLabelRoutes({ orgId: 'org-1' }), ['Bug', 'Release'])).toEqual({
        factoryProjectId: 'proj-1',
        integrationId: 'github',
        label: 'release',
        board: 'release-2',
      });
      expect(resolveIntakeLabelRoute(await storage.listLabelRoutes({ orgId: 'org-1' }), ['bug'])).toBeUndefined();
    });

    it('clears a route and returns what was removed', async () => {
      const storage = await makeStorage();
      await storage.setLabelRoute({ ...route, label: 'release', board: 'release' });

      expect(await storage.clearLabelRoute({ ...route, label: 'release' })).toEqual({
        factoryProjectId: 'proj-1',
        integrationId: 'github',
        label: 'release',
        board: 'release',
      });
      expect(await storage.clearLabelRoute({ ...route, label: 'release' })).toBeNull();
      expect(await storage.listLabelRoutes({ orgId: 'org-1' })).toEqual([]);
    });
  });
});
