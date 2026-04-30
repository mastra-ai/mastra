import { MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';

import { LocalDevStore } from './index';

describe('LocalDevStore', () => {
  const created: LocalDevStore[] = [];

  afterEach(() => {
    created.length = 0;
  });

  const make = (...args: ConstructorParameters<typeof LocalDevStore>) => {
    const store = new LocalDevStore(...args);
    created.push(store);
    return store;
  };

  it('extends MastraCompositeStore', () => {
    const store = make();
    expect(store).toBeInstanceOf(MastraCompositeStore);
  });

  it('uses an in-memory libsql default and a duckdb observability store with no config', () => {
    const store = make({ dbPath: 'file::memory:?cache=shared', duckdbPath: ':memory:' });

    expect(store.id).toBe('localdev-storage');
    expect(store.stores?.memory).toBeDefined();
    expect(store.stores?.workflows).toBeDefined();
    expect(store.stores?.observability).toBeDefined();
    expect(store.stores?.observability?.constructor.name).toBe('ObservabilityStorageDuckDB');
    expect(store.stores?.memory?.constructor.name).not.toBe('ObservabilityStorageDuckDB');
  });

  it('accepts a custom id', () => {
    const store = make({ id: 'my-store', dbPath: 'file::memory:?cache=shared', duckdbPath: ':memory:' });
    expect(store.id).toBe('my-store');
  });

  it('routes domain overrides ahead of the duckdb observability default', () => {
    const sentinel = { __sentinel: true } as any;
    const store = make({
      dbPath: 'file::memory:?cache=shared',
      duckdbPath: ':memory:',
      domains: { observability: sentinel },
    });

    expect(store.stores?.observability).toBe(sentinel);
  });
});
