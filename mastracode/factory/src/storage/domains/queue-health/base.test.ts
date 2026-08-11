/**
 * Queue-health settings domain over a real backend (libsql `:memory:`):
 * default fallback, save/read round-trip, per-(org, project) scoping, and
 * write-boundary threshold validation.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import { DEFAULT_QUEUE_HEALTH_CONFIG, QueueHealthStorage, thresholdsOrDefault } from './base.js';

async function makeStorage(): Promise<QueueHealthStorage> {
  const backend = new LibSQLFactoryStorage({ id: 'queue-health-test', url: ':memory:' });
  const domain = backend.registerDomain(new QueueHealthStorage());
  await backend.init();
  return domain;
}

describe('QueueHealthStorage', () => {
  it('returns the default config when unset', async () => {
    const storage = await makeStorage();
    expect(await storage.getConfig('org1', 'proj1')).toEqual(DEFAULT_QUEUE_HEALTH_CONFIG);
  });

  it('round-trips a saved config', async () => {
    const storage = await makeStorage();
    const config = { thresholdsSeconds: [60, 300, 3600] };
    await storage.saveConfig('org1', 'proj1', config);
    expect(await storage.getConfig('org1', 'proj1')).toEqual(config);
  });

  it('isolates configs by (org, project) scope key', async () => {
    const storage = await makeStorage();
    await storage.saveConfig('org1', 'proj1', { thresholdsSeconds: [10, 20, 30] });
    await storage.saveConfig('org1', 'proj2', { thresholdsSeconds: [40, 50, 60] });
    await storage.saveConfig('org2', 'proj1', { thresholdsSeconds: [70, 80, 90] });
    expect(await storage.getConfig('org1', 'proj1')).toEqual({ thresholdsSeconds: [10, 20, 30] });
    expect(await storage.getConfig('org1', 'proj2')).toEqual({ thresholdsSeconds: [40, 50, 60] });
    expect(await storage.getConfig('org2', 'proj1')).toEqual({ thresholdsSeconds: [70, 80, 90] });
    expect(await storage.getConfig('org2', 'proj2')).toEqual(DEFAULT_QUEUE_HEALTH_CONFIG);
  });

  it('returns clones so mutating the result does not corrupt the store', async () => {
    const storage = await makeStorage();
    await storage.saveConfig('org1', 'proj1', { thresholdsSeconds: [10, 20, 30] });
    const read = await storage.getConfig('org1', 'proj1');
    read.thresholdsSeconds.push(999);
    expect(await storage.getConfig('org1', 'proj1')).toEqual({ thresholdsSeconds: [10, 20, 30] });
  });

  it('updates in place on a second save (single row per scope)', async () => {
    const storage = await makeStorage();
    await storage.saveConfig('org1', 'proj1', { thresholdsSeconds: [10, 20, 30] });
    await storage.saveConfig('org1', 'proj1', { thresholdsSeconds: [40, 50, 60] });
    expect(await storage.getConfig('org1', 'proj1')).toEqual({ thresholdsSeconds: [40, 50, 60] });
  });

  it('rejects a descending thresholdsSeconds', async () => {
    const storage = await makeStorage();
    await expect(storage.saveConfig('org1', 'proj1', { thresholdsSeconds: [300, 60] })).rejects.toThrow(
      /strictly ascending/,
    );
  });

  it('rejects an empty thresholdsSeconds', async () => {
    const storage = await makeStorage();
    await expect(storage.saveConfig('org1', 'proj1', { thresholdsSeconds: [] })).rejects.toThrow(/non-empty/);
  });
});

describe('thresholdsOrDefault', () => {
  it('returns the stored thresholds when valid', () => {
    expect(thresholdsOrDefault({ thresholdsSeconds: [60, 300, 3600] })).toEqual([60, 300, 3600]);
  });

  it('falls back to the default on a corrupted/hand-edited row (empty or non-ascending)', () => {
    expect(thresholdsOrDefault({ thresholdsSeconds: [] })).toEqual(DEFAULT_QUEUE_HEALTH_CONFIG.thresholdsSeconds);
    expect(thresholdsOrDefault({ thresholdsSeconds: [300, 60] })).toEqual(
      DEFAULT_QUEUE_HEALTH_CONFIG.thresholdsSeconds,
    );
  });
});
