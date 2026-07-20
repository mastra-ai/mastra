import { describe, expect, it, vi } from 'vitest';
import type { MastraCompositeStore } from './base';
import { FactoryStorage, FactoryStorageDomain } from './factory-storage';
import type { CollectionSchema, FactoryStorageOps } from './factory-storage';

const ops = {
  findOne: vi.fn(),
  findMany: vi.fn(),
  insertOne: vi.fn(),
  upsertOne: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  updateAtomic: vi.fn(),
} as unknown as FactoryStorageOps;

class TestFactoryStorage extends FactoryStorage {
  readonly ops = ops;
  readonly initStorageSpy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  readonly ensureCollectionsSpy = vi.fn<(schemas: CollectionSchema[]) => Promise<void>>().mockResolvedValue(undefined);

  getMastraStorage(): MastraCompositeStore {
    return {} as MastraCompositeStore;
  }

  protected initStorage(): Promise<void> {
    return this.initStorageSpy();
  }

  ensureCollections(schemas: CollectionSchema[]): Promise<void> {
    return this.ensureCollectionsSpy(schemas);
  }

  async close(): Promise<void> {}
}

class TestDomain extends FactoryStorageDomain {
  readonly initSpy: ReturnType<typeof vi.fn<() => Promise<void>>>;

  constructor(name = 'test', initImpl: () => Promise<void> = async () => {}) {
    super(name);
    this.initSpy = vi.fn(initImpl);
  }

  override init(): Promise<void> {
    return this.initSpy();
  }

  async dangerouslyClearAll(): Promise<void> {}

  boundStorage(): FactoryStorage {
    return this.storage;
  }

  boundOps(): FactoryStorageOps {
    return this.ops;
  }

  initializeSchemas(schemas: CollectionSchema[]): Promise<void> {
    return this.ensureCollections(schemas);
  }
}

describe('FactoryStorage domain ownership', () => {
  it('binds, exposes, and initializes registered domains', async () => {
    const storage = new TestFactoryStorage();
    const domain = storage.registerDomain(new TestDomain('audit'));
    const schemas: CollectionSchema[] = [{ name: 'audit_events', columns: { id: { type: 'uuid-pk' } } }];

    expect(storage.getDomain<TestDomain>('audit')).toBe(domain);
    expect(storage.hasDomain('audit')).toBe(true);
    expect(storage.domainNames()).toEqual(['audit']);
    expect(domain.boundStorage()).toBe(storage);
    expect(domain.boundOps()).toBe(storage.ops);

    await domain.initializeSchemas(schemas);
    await storage.init();

    expect(storage.ensureCollectionsSpy).toHaveBeenCalledWith(schemas);
    expect(storage.initStorageSpy).toHaveBeenCalledTimes(1);
    expect(domain.initSpy).toHaveBeenCalledTimes(1);
    expect(storage.isDomainReady('audit')).toBe(true);
    expect(storage.domainInitError('audit')).toBeUndefined();
  });

  it('rejects duplicate names, missing lookups, and rebinding', () => {
    const first = new TestFactoryStorage();
    const second = new TestFactoryStorage();
    const domain = first.registerDomain(new TestDomain('audit'));

    expect(() => first.registerDomain(new TestDomain('audit'))).toThrow(
      "Factory storage domain 'audit' is already registered",
    );
    expect(() => first.getDomain('missing')).toThrow("Factory storage domain 'missing' is not registered");
    expect(() => second.registerDomain(domain)).toThrow(
      "Factory storage domain 'audit' is already bound to another storage instance",
    );
  });

  it('treats backend initialization as a hard failure and retries it', async () => {
    const storage = new TestFactoryStorage();
    const failure = new Error('database unavailable');
    storage.initStorageSpy.mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
    const domain = storage.registerDomain(new TestDomain());

    await expect(storage.init()).rejects.toBe(failure);
    expect(domain.initSpy).not.toHaveBeenCalled();

    await expect(storage.init()).resolves.toBeUndefined();
    expect(storage.initStorageSpy).toHaveBeenCalledTimes(2);
    expect(domain.initSpy).toHaveBeenCalledTimes(1);
  });

  it('initializes domains fail-soft and records per-domain errors', async () => {
    const storage = new TestFactoryStorage();
    const failure = new Error('migration failed');
    const broken = storage.registerDomain(
      new TestDomain('broken', async () => {
        throw failure;
      }),
    );
    const healthy = storage.registerDomain(new TestDomain('healthy'));

    await expect(storage.init()).resolves.toBeUndefined();

    expect(broken.initSpy).toHaveBeenCalledTimes(1);
    expect(healthy.initSpy).toHaveBeenCalledTimes(1);
    expect(storage.isDomainReady('broken')).toBe(false);
    expect(storage.domainInitError('broken')).toBe(failure);
    expect(storage.isDomainReady('healthy')).toBe(true);
  });

  it('coalesces concurrent backend and domain initialization', async () => {
    const storage = new TestFactoryStorage();
    let releaseBackend!: () => void;
    const backendGate = new Promise<void>(resolve => {
      releaseBackend = resolve;
    });
    storage.initStorageSpy.mockImplementation(() => backendGate);

    let releaseDomain!: () => void;
    const domainGate = new Promise<void>(resolve => {
      releaseDomain = resolve;
    });
    const domain = storage.registerDomain(new TestDomain('audit', () => domainGate));

    const first = storage.ensureDomainReady('audit');
    const second = storage.ensureDomainReady('audit');
    releaseBackend();
    await Promise.resolve();
    releaseDomain();
    await Promise.all([first, second]);

    expect(storage.initStorageSpy).toHaveBeenCalledTimes(1);
    expect(domain.initSpy).toHaveBeenCalledTimes(1);
  });

  it('initializes domains registered after storage startup on demand', async () => {
    const storage = new TestFactoryStorage();
    await storage.init();

    const domain = storage.registerDomain(new TestDomain('late'));
    expect(storage.isDomainReady('late')).toBe(false);
    expect(domain.initSpy).not.toHaveBeenCalled();

    await storage.ensureDomainReady('late');
    expect(storage.initStorageSpy).toHaveBeenCalledTimes(1);
    expect(domain.initSpy).toHaveBeenCalledTimes(1);
    expect(storage.isDomainReady('late')).toBe(true);
  });

  it('retries failed domain initialization and coalesces each attempt', async () => {
    const storage = new TestFactoryStorage();
    const failure = new Error('try again');
    const domain = storage.registerDomain(new TestDomain('retry'));
    domain.initSpy.mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);

    const first = storage.ensureDomainReady('retry');
    const second = storage.ensureDomainReady('retry');
    await expect(Promise.all([first, second])).rejects.toBe(failure);
    expect(domain.initSpy).toHaveBeenCalledTimes(1);
    expect(storage.domainInitError('retry')).toBe(failure);

    await expect(storage.ensureDomainReady('retry')).resolves.toBeUndefined();
    expect(domain.initSpy).toHaveBeenCalledTimes(2);
    expect(storage.isDomainReady('retry')).toBe(true);
    expect(storage.domainInitError('retry')).toBeUndefined();
  });
});
