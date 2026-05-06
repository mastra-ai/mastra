import { MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalDevStore } from './index';

describe('LocalDevStore', () => {
  const created: LocalDevStore[] = [];

  afterEach(() => {
    created.length = 0;
    vi.restoreAllMocks();
  });

  const make = (...args: ConstructorParameters<typeof LocalDevStore>) => {
    const store = new LocalDevStore(...args);
    created.push(store);
    return store;
  };

  it('extends MastraCompositeStore', () => {
    const store = make({ dbPath: 'file::memory:?cache=shared', duckdbPath: ':memory:' });
    expect(store).toBeInstanceOf(MastraCompositeStore);
  });

  it('passes the documented defaults to its underlying stores when called with no config', async () => {
    const libsqlConfigs: unknown[] = [];
    const duckdbConfigs: unknown[] = [];

    const libsqlMod = await import('@mastra/libsql');
    const duckdbMod = await import('@mastra/duckdb');
    const RealLibSQL = libsqlMod.LibSQLStore;
    const RealDuckDB = duckdbMod.DuckDBStore;

    class SpyLibSQL extends RealLibSQL {
      constructor(config: ConstructorParameters<typeof RealLibSQL>[0]) {
        libsqlConfigs.push(config);
        super({ ...config, url: 'file::memory:?cache=shared' });
      }
    }
    class SpyDuckDB extends RealDuckDB {
      constructor(config?: ConstructorParameters<typeof RealDuckDB>[0]) {
        duckdbConfigs.push(config);
        super({ ...config, path: ':memory:' });
      }
    }

    vi.spyOn(libsqlMod, 'LibSQLStore').mockImplementation(SpyLibSQL as never);
    vi.spyOn(duckdbMod, 'DuckDBStore').mockImplementation(SpyDuckDB as never);

    new LocalDevStore();

    expect(libsqlConfigs[0]).toEqual({ id: 'mastra-storage', url: 'file:./mastra.db' });
    expect(duckdbConfigs[0]).toEqual({ path: 'mastra.duckdb' });
  });

  it('exposes a duckdb-backed observability store and a libsql-backed memory store', () => {
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
