import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { getBuiltinMCPCapabilities } from './capabilities';

describe('getBuiltinMCPCapabilities', () => {
  it('looks the observability store up again after a failed lookup instead of hiding its tools until restart', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({ logger: false, storage });
    const getStore = storage.getStore.bind(storage);
    vi.spyOn(storage, 'getStore').mockImplementationOnce(async domain => {
      if (domain === 'observability') throw new Error('connection reset');
      return getStore(domain);
    });

    expect((await getBuiltinMCPCapabilities(mastra)).observability).toBeNull();
    expect((await getBuiltinMCPCapabilities(mastra)).observability).not.toBeNull();
  });

  it('resolves store capabilities once when the lookup succeeds', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({ logger: false, storage });
    const getStore = vi.spyOn(storage, 'getStore');

    await getBuiltinMCPCapabilities(mastra);
    await getBuiltinMCPCapabilities(mastra);
    expect(getStore.mock.calls.filter(([domain]) => domain === 'observability')).toHaveLength(1);
  });
});
