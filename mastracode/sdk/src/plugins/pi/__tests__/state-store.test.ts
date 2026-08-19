import { describe, expect, it } from 'vitest';

import { MastraPiExtensionGeneration } from '../runtime.js';
import { PiStateStore, type PiStateBackend } from '../state-store.js';

class MemoryBackend implements PiStateBackend {
  values = new Map<string, unknown>();
  async get(key: string) {
    return this.values.get(key);
  }
  async set(key: string, value: unknown) {
    this.values.set(key, value);
  }
}

describe('Pi state store', () => {
  it('persists stable plugin namespaces across generation reloads and isolates plugins', async () => {
    const backend = new MemoryBackend();
    const first = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/one.ts');
    const reloaded = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/two.ts');
    const other = new MastraPiExtensionGeneration('other', 'extension', '/tmp/other.ts');
    await new PiStateStore(first, backend).append('checkpoint', { count: 1 });

    expect(await new PiStateStore(reloaded, backend).list()).toMatchObject([
      { type: 'checkpoint', data: { count: 1 } },
    ]);
    expect(await new PiStateStore(other, backend).list()).toEqual([]);
  });

  it('serializes concurrent appends without losing entries', async () => {
    const backend = new MemoryBackend();
    const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
    const store = new PiStateStore(generation, backend);
    await Promise.all([store.append('counter', { value: 1 }), store.append('counter', { value: 2 })]);
    await expect(store.list()).resolves.toHaveLength(2);
  });

  it('filters malformed and non-JSON-safe stored entries at the persistence boundary', async () => {
    const backend = new MemoryBackend();
    const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
    const store = new PiStateStore(generation, backend);
    backend.values.set('mastracode.pi.plugin.extension.entries', [
      { version: 1, type: 'valid', data: { value: 1 }, createdAt: '2026-08-19T00:00:00.000Z' },
      { version: 1, type: '', data: {}, createdAt: '2026-08-19T00:00:00.000Z' },
      { version: 1, type: 'bad-date', data: {}, createdAt: 'not-a-date' },
      { version: 1, type: 'bad-data', data: 1n, createdAt: '2026-08-19T00:00:00.000Z' },
    ]);

    await expect(store.list()).resolves.toEqual([
      { version: 1, type: 'valid', data: { value: 1 }, createdAt: '2026-08-19T00:00:00.000Z' },
    ]);
  });

  it('rejects non-serializable state and stale contexts', async () => {
    const backend = new MemoryBackend();
    const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
    const store = new PiStateStore(generation, backend);
    await expect(store.append('bad', 1n)).rejects.toThrow('JSON serializable');
    await expect(store.append('bad', { value: () => 'hidden' })).rejects.toThrow('JSON serializable');
    await generation.invalidate();
    await expect(store.list()).rejects.toThrow('stale');
  });
});
