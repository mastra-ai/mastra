import { EventEmitterPubSub } from '@mastra/core/events';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createFactorySecretEncryption } from '../secret-encryption.js';
import { SandboxEnvsStorage } from '../storage/domains/sandbox-envs/base.js';
import { CachedSandboxEnvs } from './sandbox-env-cache.js';

const ORG = 'org-1';
const PROJECT = 'proj-1';

async function makeStore() {
  const backend = new LibSQLFactoryStorage({ id: 'sandbox-env-cache-test', url: ':memory:' });
  const store = backend.registerDomain(
    new SandboxEnvsStorage(createFactorySecretEncryption({ primary: { id: 'v1', key: new Uint8Array(32).fill(3) } })),
  );
  await backend.init();
  onTestFinished(() => backend.close());
  // Count only the reads the cache makes (the store's own resolve reads revisions internally).
  const reads = {
    revisions: vi.fn((orgId: string, projectId: string) => store.revisions(orgId, projectId)),
    resolve: vi.fn((orgId: string, projectId: string) => store.resolve(orgId, projectId)),
  };
  return {
    store,
    counted: {
      ...store,
      list: store.list.bind(store),
      set: store.set.bind(store),
      updateAppliesTo: store.updateAppliesTo.bind(store),
      delete: store.delete.bind(store),
      ...reads,
    },
    reads,
  };
}

/** Wait for the in-process bus to deliver. */
const settle = () => new Promise(resolve => setTimeout(resolve, 10));

describe('CachedSandboxEnvs', () => {
  it('serves repeated reads from memory and decrypts once while nothing changes', async () => {
    const { store, counted, reads } = await makeStore();
    await store.set(ORG, PROJECT, { name: 'TOKEN', value: 'one', appliesTo: 'runtime' }, 'u');
    const cache = new CachedSandboxEnvs(counted, { now: () => 0 });

    for (let i = 0; i < 5; i++) {
      expect((await cache.resolve(ORG, PROJECT)).runtime).toEqual({ TOKEN: 'one' });
      await cache.revisions(ORG, PROJECT);
    }
    expect(reads.revisions).toHaveBeenCalledTimes(1);
    expect(reads.resolve).toHaveBeenCalledTimes(1);
  });

  it("shows this replica's write on the next read", async () => {
    const { store } = await makeStore();
    const cache = new CachedSandboxEnvs(store, { now: () => 0 });
    await cache.set(ORG, PROJECT, { name: 'TOKEN', value: 'one', appliesTo: 'runtime' }, 'u');
    expect((await cache.resolve(ORG, PROJECT)).runtime).toEqual({ TOKEN: 'one' });

    await cache.set(ORG, PROJECT, { name: 'TOKEN', value: 'two', appliesTo: 'runtime' }, 'u');
    expect((await cache.resolve(ORG, PROJECT)).runtime).toEqual({ TOKEN: 'two' });
    await cache.delete(ORG, PROJECT, 'TOKEN');
    expect((await cache.resolve(ORG, PROJECT)).runtime).toEqual({});
  });

  it("shows another replica's write as soon as its event arrives", async () => {
    const { store } = await makeStore();
    const pubsub = new EventEmitterPubSub();
    const here = new CachedSandboxEnvs(store, { pubsub, crossProcess: true, now: () => 0 });
    const there = new CachedSandboxEnvs(store, { pubsub, crossProcess: true, now: () => 0 });
    const unsubscribe = await here.subscribe();
    onTestFinished(unsubscribe);
    await there.set(ORG, PROJECT, { name: 'TOKEN', value: 'one', appliesTo: 'runtime' }, 'u');
    await settle();
    expect((await here.resolve(ORG, PROJECT)).runtime).toEqual({ TOKEN: 'one' });

    await there.set(ORG, PROJECT, { name: 'TOKEN', value: 'two', appliesTo: 'runtime' }, 'u');
    await settle();
    expect((await here.resolve(ORG, PROJECT)).runtime).toEqual({ TOKEN: 'two' });
  });

  it('re-reads after a minute with an event bus, in case an event was missed', async () => {
    const { store, counted, reads } = await makeStore();
    let now = 0;
    const cache = new CachedSandboxEnvs(counted, {
      pubsub: new EventEmitterPubSub(),
      crossProcess: true,
      now: () => now,
    });
    await cache.resolve(ORG, PROJECT);
    // A write this cache never hears about, like a dropped event.
    await store.set(ORG, PROJECT, { name: 'TOKEN', value: 'one', appliesTo: 'runtime' }, 'u');

    now = 59_999;
    expect((await cache.resolve(ORG, PROJECT)).runtime).toEqual({});
    expect(reads.revisions).toHaveBeenCalledTimes(1);
    now = 60_000;
    expect((await cache.resolve(ORG, PROJECT)).runtime).toEqual({ TOKEN: 'one' });
    expect(reads.revisions).toHaveBeenCalledTimes(2);
  });

  it('re-reads after a second without a cross-process bus, as before', async () => {
    const { counted, reads } = await makeStore();
    let now = 0;
    const cache = new CachedSandboxEnvs(counted, { now: () => now });
    await cache.revisions(ORG, PROJECT);
    now = 999;
    await cache.revisions(ORG, PROJECT);
    expect(reads.revisions).toHaveBeenCalledTimes(1);
    now = 1000;
    await cache.revisions(ORG, PROJECT);
    expect(reads.revisions).toHaveBeenCalledTimes(2);
  });

  it('keeps the decrypted values across a re-read when the revision did not move', async () => {
    const { store, counted, reads } = await makeStore();
    await store.set(ORG, PROJECT, { name: 'TOKEN', value: 'one', appliesTo: 'runtime' }, 'u');
    let now = 0;
    const cache = new CachedSandboxEnvs(counted, { now: () => now });
    await cache.resolve(ORG, PROJECT);
    now = 5_000;
    await cache.resolve(ORG, PROJECT);
    expect(reads.revisions).toHaveBeenCalledTimes(2);
    expect(reads.resolve).toHaveBeenCalledTimes(1);
  });

  it('never serves a failed read from memory', async () => {
    const { counted, reads } = await makeStore();
    const cache = new CachedSandboxEnvs(counted, { now: () => 0 });
    reads.revisions.mockRejectedValueOnce(new Error('down'));
    await expect(cache.revisions(ORG, PROJECT)).rejects.toThrow('down');
    await Promise.resolve();
    expect(await cache.revisions(ORG, PROJECT)).toBeNull();

    reads.resolve.mockRejectedValueOnce(new Error('Unknown key id'));
    await expect(cache.resolve(ORG, PROJECT)).rejects.toThrow('Unknown key id');
    await Promise.resolve();
    expect((await cache.resolve(ORG, PROJECT)).runtime).toEqual({});
  });
});
