import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import { DEFAULT_INTAKE_CONFIG, IntakeStorage } from './base.js';

async function makeStorage(): Promise<IntakeStorage> {
  const backend = new LibSQLFactoryStorage({ id: 'intake-test', url: ':memory:' });
  const domain = backend.registerDomain(new IntakeStorage());
  await backend.init();
  return domain;
}

describe('IntakeStorage', () => {
  it('returns a fresh empty config for every caller', async () => {
    const storage = await makeStorage();
    const first = await storage.getConfig({ orgId: 'org1', userId: 'user1' });
    first.github = { enabled: false, sourceIds: null };
    const second = await storage.getConfig({ orgId: 'org1', userId: 'user1' });

    expect(second).toEqual(DEFAULT_INTAKE_CONFIG);
    expect(second).not.toBe(DEFAULT_INTAKE_CONFIG);
  });

  it('round-trips dynamic integration selections per org and user', async () => {
    const storage = await makeStorage();
    const config = {
      github: { enabled: true, sourceIds: ['repo-1'] },
      linear: { enabled: false, sourceIds: null },
    };

    await storage.saveConfig({ orgId: 'org1', userId: 'user1', config });
    expect(await storage.getConfig({ orgId: 'org1', userId: 'user1' })).toEqual(config);
    expect(await storage.getConfig({ orgId: 'org1', userId: 'user2' })).toEqual(DEFAULT_INTAKE_CONFIG);
    expect(await storage.getConfig({ orgId: 'org2', userId: 'user1' })).toEqual(DEFAULT_INTAKE_CONFIG);

    const updated = { ...config, linear: { enabled: true, sourceIds: ['team-1'] } };
    await storage.saveConfig({ orgId: 'org1', userId: 'user1', config: updated });
    expect(await storage.getConfig({ orgId: 'org1', userId: 'user1' })).toEqual(updated);
  });

  it('converges concurrent first saves onto one row', async () => {
    const storage = await makeStorage();
    const a = { github: { enabled: true, sourceIds: ['a'] } };
    const b = { gitlab: { enabled: true, sourceIds: ['b'] } };

    await Promise.all([
      storage.saveConfig({ orgId: 'org1', userId: 'user1', config: a }),
      storage.saveConfig({ orgId: 'org1', userId: 'user1', config: b }),
    ]);

    expect([a, b]).toContainEqual(await storage.getConfig({ orgId: 'org1', userId: 'user1' }));
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
        { integrationId: 'linear', sourceId: 'src-a', factoryProjectId: 'proj-2' },
      ]);
      expect(await storage.listBoundSourceIds({ ...binding, factoryProjectId: 'proj-1' })).toEqual([]);
    });

    it('clears a binding and returns its project', async () => {
      const storage = await makeStorage();
      const binding = { orgId: 'org1', integrationId: 'linear', sourceId: 'src-a' };

      await storage.setBinding({ ...binding, factoryProjectId: 'proj-1' });
      expect(await storage.clearBinding(binding)).toEqual({
        integrationId: 'linear',
        sourceId: 'src-a',
        factoryProjectId: 'proj-1',
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
  });
});
