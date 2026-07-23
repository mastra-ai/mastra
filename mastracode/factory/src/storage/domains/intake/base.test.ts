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

  it('lists enabled source selections across tenants for background workers', async () => {
    const storage = await makeStorage();
    await Promise.all([
      storage.saveConfig({
        orgId: 'org1',
        userId: 'user1',
        config: { linear: { enabled: true, sourceIds: ['linear-project:a'] } },
      }),
      storage.saveConfig({
        orgId: 'org1',
        userId: 'user2',
        config: { linear: { enabled: false, sourceIds: ['linear-project:b'] } },
      }),
      storage.saveConfig({
        orgId: 'org2',
        userId: 'user3',
        config: { linear: { enabled: true, sourceIds: null } },
      }),
      storage.saveConfig({
        orgId: 'org3',
        userId: 'user4',
        config: { github: { enabled: true, sourceIds: ['repo-1'] } },
      }),
    ]);

    await expect(storage.listEnabledSourceSelections('linear')).resolves.toEqual([
      { orgId: 'org1', userId: 'user1', sourceIds: ['linear-project:a'] },
    ]);
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
});
