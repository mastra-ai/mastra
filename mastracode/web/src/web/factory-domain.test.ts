import type { ApiRoute } from '@mastra/core/server';
import type { FactoryStorage } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { FactoryDomain } from './factory-domain';

class TestDomain extends FactoryDomain {
  constructor({ storage }: { storage: FactoryStorage }) {
    super({ storage });
  }

  dependency(): FactoryStorage {
    return this.storage;
  }

  routes(): ApiRoute[] {
    return [];
  }
}

describe('FactoryDomain', () => {
  it('retains the injected storage dependency and requires a route surface', () => {
    const storage = {} as FactoryStorage;
    const domain = new TestDomain({ storage });

    expect(domain.dependency()).toBe(storage);
    expect(domain.routes()).toEqual([]);
  });
});
