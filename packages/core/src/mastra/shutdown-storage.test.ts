import { describe, it, expect, vi } from 'vitest';

import { MastraCompositeStore } from '../storage/base';
import { InMemoryStore } from '../storage/mock';

import { Mastra } from './index';

describe('Mastra.shutdown() storage teardown', () => {
  it('closes a store composed behind a MastraCompositeStore', async () => {
    // shutdown() only reaches the storage it was given. When that storage is a
    // composite, the adapter holding the real connection sits one level down —
    // if the composite drops close(), the connection outlives shutdown() and
    // keeps the process alive.
    const inner = new InMemoryStore({ id: 'inner' });
    const innerCloseSpy = vi.spyOn(inner, 'close');

    const mastra = new Mastra({
      storage: new MastraCompositeStore({ id: 'composite', default: inner }),
    });

    await mastra.shutdown();

    expect(innerCloseSpy).toHaveBeenCalledTimes(1);
  });
});
