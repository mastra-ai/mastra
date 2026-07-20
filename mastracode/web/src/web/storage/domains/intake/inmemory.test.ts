import { describe, expect, it } from 'vitest';

import { DEFAULT_INTAKE_CONFIG } from './base';
import { IntakeStorageInMemory } from './inmemory';

describe('IntakeStorageInMemory', () => {
  it('returns a fresh default config for every caller', async () => {
    const storage = new IntakeStorageInMemory();

    const first = await storage.getConfig('org1', 'user1');
    first.github.enabled = false;
    const second = await storage.getConfig('org1', 'user1');

    expect(second).toEqual(DEFAULT_INTAKE_CONFIG);
    expect(second).not.toBe(DEFAULT_INTAKE_CONFIG);
    expect(second.github).not.toBe(DEFAULT_INTAKE_CONFIG.github);
  });

  it('returns defaults for a prerelease github.projectIds row without emitting the old key', async () => {
    const storage = new IntakeStorageInMemory();
    storage.seedRawConfig('org1', 'user1', {
      github: { enabled: false, projectIds: ['legacy-repo'] },
      linear: { enabled: true, projectIds: ['lp-1'] },
    });

    const config = await storage.getConfig('org1', 'user1');
    expect(config).toEqual(DEFAULT_INTAKE_CONFIG);
    expect(config.github).toEqual({ enabled: true, repositoryIds: null });
    expect(config.github).not.toHaveProperty('projectIds');
  });
});
