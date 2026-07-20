/**
 * Intake settings domain over a real backend (libsql `:memory:`): default
 * config isolation, save/read round-trip, and per-(org, user) scoping.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import { DEFAULT_INTAKE_CONFIG, IntakeStorage } from './base';

async function makeStorage(): Promise<IntakeStorage> {
  const backend = new LibSQLFactoryStorage({ id: 'intake-test', url: ':memory:' });
  const domain = backend.registerDomain(new IntakeStorage());
  await backend.init();
  return domain;
}

describe('IntakeStorage', () => {
  it('returns a fresh default config for every caller', async () => {
    const storage = await makeStorage();

    const first = await storage.getConfig('org1', 'user1');
    first.github.enabled = false;
    const second = await storage.getConfig('org1', 'user1');

    expect(second).toEqual(DEFAULT_INTAKE_CONFIG);
    expect(second).not.toBe(DEFAULT_INTAKE_CONFIG);
    expect(second.github).not.toBe(DEFAULT_INTAKE_CONFIG.github);
  });

  it('round-trips saved config per (org, user)', async () => {
    const storage = await makeStorage();
    const config = {
      github: { enabled: true, repositoryIds: ['p1'] },
      linear: { enabled: false, projectIds: null },
    };

    await storage.saveConfig('org1', 'user1', config);
    expect(await storage.getConfig('org1', 'user1')).toEqual(config);
    // Other tenants are untouched.
    expect(await storage.getConfig('org1', 'user2')).toEqual(DEFAULT_INTAKE_CONFIG);
    expect(await storage.getConfig('org2', 'user1')).toEqual(DEFAULT_INTAKE_CONFIG);

    // Second save updates in place (single row per tenant).
    const updated = { ...config, linear: { enabled: true, projectIds: ['l1'] } };
    await storage.saveConfig('org1', 'user1', updated);
    expect(await storage.getConfig('org1', 'user1')).toEqual(updated);
  });

  it('converges concurrent first saves onto one row', async () => {
    const storage = await makeStorage();
    const a = { github: { enabled: true, repositoryIds: ['a'] }, linear: { enabled: true, projectIds: null } };
    const b = { github: { enabled: true, repositoryIds: ['b'] }, linear: { enabled: true, projectIds: null } };

    await Promise.all([storage.saveConfig('org1', 'user1', a), storage.saveConfig('org1', 'user1', b)]);

    const result = await storage.getConfig('org1', 'user1');
    expect([a, b]).toContainEqual(result);
  });
});
