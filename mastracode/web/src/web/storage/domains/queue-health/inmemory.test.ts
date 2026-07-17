import { describe, expect, it } from 'vitest';

import { DEFAULT_QUEUE_HEALTH_CONFIG } from './base';
import { QueueHealthStorageInMemory } from './inmemory';

describe('QueueHealthStorageInMemory', () => {
  it('returns the default config when unset', async () => {
    const store = new QueueHealthStorageInMemory();
    expect(await store.getConfig('org1', 'proj1')).toEqual(DEFAULT_QUEUE_HEALTH_CONFIG);
  });

  it('round-trips a saved config', async () => {
    const store = new QueueHealthStorageInMemory();
    const config = { thresholdsSeconds: [60, 300, 3600] };
    await store.saveConfig('org1', 'proj1', config);
    expect(await store.getConfig('org1', 'proj1')).toEqual(config);
  });

  it('isolates configs by (org, project) scope key', async () => {
    const store = new QueueHealthStorageInMemory();
    await store.saveConfig('org1', 'proj1', { thresholdsSeconds: [10, 20, 30] });
    await store.saveConfig('org1', 'proj2', { thresholdsSeconds: [40, 50, 60] });
    await store.saveConfig('org2', 'proj1', { thresholdsSeconds: [70, 80, 90] });
    expect(await store.getConfig('org1', 'proj1')).toEqual({ thresholdsSeconds: [10, 20, 30] });
    expect(await store.getConfig('org1', 'proj2')).toEqual({ thresholdsSeconds: [40, 50, 60] });
    expect(await store.getConfig('org2', 'proj1')).toEqual({ thresholdsSeconds: [70, 80, 90] });
    expect(await store.getConfig('org2', 'proj2')).toEqual(DEFAULT_QUEUE_HEALTH_CONFIG);
  });

  it('returns clones so mutating the result does not corrupt the store', async () => {
    const store = new QueueHealthStorageInMemory();
    await store.saveConfig('org1', 'proj1', { thresholdsSeconds: [10, 20, 30] });
    const read = await store.getConfig('org1', 'proj1');
    read.thresholdsSeconds.push(999);
    expect(await store.getConfig('org1', 'proj1')).toEqual({ thresholdsSeconds: [10, 20, 30] });
  });

  it('rejects a descending thresholdsSeconds', async () => {
    const store = new QueueHealthStorageInMemory();
    await expect(store.saveConfig('org1', 'proj1', { thresholdsSeconds: [300, 60] })).rejects.toThrow(
      /strictly ascending/,
    );
  });

  it('rejects an empty thresholdsSeconds', async () => {
    const store = new QueueHealthStorageInMemory();
    await expect(store.saveConfig('org1', 'proj1', { thresholdsSeconds: [] })).rejects.toThrow(/non-empty/);
  });
});
