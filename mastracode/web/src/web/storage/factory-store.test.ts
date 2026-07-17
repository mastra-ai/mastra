import { describe, expect, it, vi } from 'vitest';

import type { FactoryStorageContext, FactoryStorageDomain } from './domain';
import { FactoryStore } from './factory-store';

/** Fake context — domains under test never touch the pool. */
const ctx = { pool: {} } as unknown as FactoryStorageContext;

function makeDomain(name: string, init: FactoryStorageDomain['init'] = async () => {}): FactoryStorageDomain {
  return { name, init };
}

describe('FactoryStore', () => {
  it('registers domains and exposes them via get()/names()', () => {
    const store = new FactoryStore();
    const intake = makeDomain('intake');
    const audit = makeDomain('audit');
    store.register(intake);
    store.register(audit);

    expect(store.get('intake')).toBe(intake);
    expect(store.get('audit')).toBe(audit);
    expect(store.get('nope')).toBeUndefined();
    expect(store.names()).toEqual(['intake', 'audit']);
  });

  it('rejects duplicate domain names', () => {
    const store = new FactoryStore();
    store.register(makeDomain('intake'));
    expect(() => store.register(makeDomain('intake'))).toThrow(/already registered/);
  });

  it('init() initializes every registered domain with the shared context', async () => {
    const store = new FactoryStore();
    const initA = vi.fn(async () => {});
    const initB = vi.fn(async () => {});
    store.register(makeDomain('a', initA));
    store.register(makeDomain('b', initB));

    await store.init(ctx);

    expect(initA).toHaveBeenCalledExactlyOnceWith(ctx);
    expect(initB).toHaveBeenCalledExactlyOnceWith(ctx);
    expect(store.isReady('a')).toBe(true);
    expect(store.isReady('b')).toBe(true);
  });

  it('init() is fail-soft per domain: one failure never aborts boot or the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const store = new FactoryStore();
      store.register(makeDomain('good'));
      store.register(
        makeDomain('bad', async () => {
          throw new Error('relation creation failed');
        }),
      );

      await expect(store.init(ctx)).resolves.toBeUndefined();

      expect(store.isReady('good')).toBe(true);
      expect(store.isReady('bad')).toBe(false);
      expect(store.initError('bad')?.message).toBe('relation creation failed');
      expect(store.initError('good')).toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });

  it('repeated init() coalesces successful domains (init runs once)', async () => {
    const store = new FactoryStore();
    const init = vi.fn(async () => {});
    store.register(makeDomain('a', init));

    await Promise.all([store.init(ctx), store.init(ctx)]);
    await store.init(ctx);

    expect(init).toHaveBeenCalledTimes(1);
  });

  it('ensureReady() retries a previously failed init', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const store = new FactoryStore();
      let attempts = 0;
      store.register(
        makeDomain('flaky', async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('db unreachable');
        }),
      );

      await store.init(ctx);
      expect(store.isReady('flaky')).toBe(false);

      await store.ensureReady('flaky');
      expect(store.isReady('flaky')).toBe(true);
      expect(store.initError('flaky')).toBeUndefined();
      expect(attempts).toBe(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('ensureReady() throws for unknown domains and before init()', async () => {
    const store = new FactoryStore();
    await expect(store.ensureReady('nope')).rejects.toThrow(/Unknown domain/);

    store.register(makeDomain('a'));
    await expect(store.ensureReady('a')).rejects.toThrow(/Not initialized/);
  });

  it('initializes an externally registered (integration-style) domain after init() via ensureReady()', async () => {
    const store = new FactoryStore();
    store.register(makeDomain('intake'));
    await store.init(ctx);

    // An integration registers its own domain through the same path.
    const init = vi.fn(async () => {});
    store.register(makeDomain('github', init));
    expect(store.isReady('github')).toBe(false);

    await store.ensureReady('github');
    expect(init).toHaveBeenCalledExactlyOnceWith(ctx);
    expect(store.isReady('github')).toBe(true);
  });
});
