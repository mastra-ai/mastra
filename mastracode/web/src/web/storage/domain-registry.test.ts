import { describe, expect, it, vi } from 'vitest';

import { DomainRegistry } from './domain-registry';
import type { FactoryStorageContext, FactoryStorageDomain } from './domain';

/** Fake context — domains under test never touch the backend. */
const ctx = { storage: {} } as unknown as FactoryStorageContext;

function makeDomain(name: string, init: FactoryStorageDomain['init'] = async () => {}): FactoryStorageDomain {
  return { name, init };
}

describe('DomainRegistry', () => {
  it('registers domains and exposes them via get()/names()', () => {
    const registry = new DomainRegistry();
    const intake = makeDomain('intake');
    const audit = makeDomain('audit');
    registry.register(intake);
    registry.register(audit);

    expect(registry.get('intake')).toBe(intake);
    expect(registry.get('audit')).toBe(audit);
    expect(registry.get('nope')).toBeUndefined();
    expect(registry.names()).toEqual(['intake', 'audit']);
  });

  it('rejects duplicate domain names', () => {
    const registry = new DomainRegistry();
    registry.register(makeDomain('intake'));
    expect(() => registry.register(makeDomain('intake'))).toThrow(/already registered/);
  });

  it('exposes the model-credentials domain via the typed accessor', () => {
    const registry = new DomainRegistry();
    expect(() => registry.credentials).toThrow(/not registered/);
    const credentials = makeDomain('model-credentials');
    registry.register(credentials);
    expect(registry.credentials).toBe(credentials);
  });

  it('init() initializes every registered domain with the shared context', async () => {
    const registry = new DomainRegistry();
    const initA = vi.fn(async () => {});
    const initB = vi.fn(async () => {});
    registry.register(makeDomain('a', initA));
    registry.register(makeDomain('b', initB));

    await registry.init(ctx);

    expect(initA).toHaveBeenCalledExactlyOnceWith(ctx);
    expect(initB).toHaveBeenCalledExactlyOnceWith(ctx);
    expect(registry.isReady('a')).toBe(true);
    expect(registry.isReady('b')).toBe(true);
  });

  it('init() is fail-soft per domain: one failure never aborts boot or the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const registry = new DomainRegistry();
      registry.register(makeDomain('good'));
      registry.register(
        makeDomain('bad', async () => {
          throw new Error('relation creation failed');
        }),
      );

      await expect(registry.init(ctx)).resolves.toBeUndefined();

      expect(registry.isReady('good')).toBe(true);
      expect(registry.isReady('bad')).toBe(false);
      expect(registry.initError('bad')?.message).toBe('relation creation failed');
      expect(registry.initError('good')).toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });

  it('repeated init() coalesces successful domains (init runs once)', async () => {
    const registry = new DomainRegistry();
    const init = vi.fn(async () => {});
    registry.register(makeDomain('a', init));

    await Promise.all([registry.init(ctx), registry.init(ctx)]);
    await registry.init(ctx);

    expect(init).toHaveBeenCalledTimes(1);
  });

  it('ensureReady() retries a previously failed init', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const registry = new DomainRegistry();
      let attempts = 0;
      registry.register(
        makeDomain('flaky', async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('db unreachable');
        }),
      );

      await registry.init(ctx);
      expect(registry.isReady('flaky')).toBe(false);

      await registry.ensureReady('flaky');
      expect(registry.isReady('flaky')).toBe(true);
      expect(registry.initError('flaky')).toBeUndefined();
      expect(attempts).toBe(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('ensureReady() throws for unknown domains and before init()', async () => {
    const registry = new DomainRegistry();
    await expect(registry.ensureReady('nope')).rejects.toThrow(/Unknown domain/);

    registry.register(makeDomain('a'));
    await expect(registry.ensureReady('a')).rejects.toThrow(/Not initialized/);
  });

  it('initializes an externally registered (integration-style) domain after init() via ensureReady()', async () => {
    const registry = new DomainRegistry();
    registry.register(makeDomain('intake'));
    await registry.init(ctx);

    // An integration registers its own domain through the same path.
    const init = vi.fn(async () => {});
    registry.register(makeDomain('github', init));
    expect(registry.isReady('github')).toBe(false);

    await registry.ensureReady('github');
    expect(init).toHaveBeenCalledExactlyOnceWith(ctx);
    expect(registry.isReady('github')).toBe(true);
  });
});
