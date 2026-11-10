import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from './index';

function createRemoteStore() {
  const client = createClient({ url: 'file::memory:' });
  // A `{ client }` config is treated as a remote DB, exercising the parallel init path.
  const store = new LibSQLStore({ id: 'remote-init-test', client, initialBackoffMs: 1 });
  const domains = Object.entries((store as any).stores)
    .filter(([name, domain]) => name !== 'knowledge' && domain)
    .map(([, domain]) => domain as { init: () => Promise<void> });
  return { client, store, domains };
}

describe('LibSQLStore remote init', () => {
  let client: ReturnType<typeof createClient> | undefined;
  afterEach(() => client?.close());

  it('retries a domain init that fails with a transient network error', async () => {
    const setup = createRemoteStore();
    client = setup.client;
    for (const domain of setup.domains) vi.spyOn(domain, 'init').mockResolvedValue();
    const flaky = vi
      .spyOn(setup.domains[3]!, 'init')
      .mockRejectedValueOnce(new Error('wrapper', { cause: new TypeError('fetch failed') }))
      .mockResolvedValue();

    await expect(setup.store.init()).resolves.toBeUndefined();
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-network errors and allows a later init to run again', async () => {
    const setup = createRemoteStore();
    client = setup.client;
    for (const domain of setup.domains) vi.spyOn(domain, 'init').mockResolvedValue();
    const failing = vi
      .spyOn(setup.domains[0]!, 'init')
      .mockRejectedValueOnce(new Error('SQLITE_ERROR: syntax error'))
      .mockResolvedValue();

    await expect(setup.store.init()).rejects.toThrow('syntax error');
    expect(failing).toHaveBeenCalledTimes(1);

    await expect(setup.store.init()).resolves.toBeUndefined();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('caps concurrent domain inits at 5', async () => {
    const setup = createRemoteStore();
    client = setup.client;
    let active = 0;
    let peak = 0;
    for (const domain of setup.domains) {
      vi.spyOn(domain, 'init').mockImplementation(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active--;
      });
    }

    await setup.store.init();
    expect(setup.domains.length).toBeGreaterThan(5);
    expect(peak).toBe(5);
  });
});
