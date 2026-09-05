import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { InMemoryStore, MastraCompositeStore } from '../../storage';
import { Knowledge } from '../index';

const scope = ['org:acme', 'resource:mastra'];

describe('Knowledge', () => {
  it('reconciles configured structure in the background and coalesces explicit waits', async () => {
    const storage = new InMemoryStore({ id: 'structured' });
    const domain = storage.stores.knowledge!;
    vi.spyOn(domain, 'getCapabilities').mockReturnValue({
      contractVersion: 2,
      schemaVersion: 2,
      supportsV2: true,
      supportsExplicitReset: true,
    });
    const result = { scopes: { 'org:acme': 'scope-id' }, createdScopeIds: ['scope-id'], changed: true, accessEpoch: 1 };
    const reconcile = vi.spyOn(domain, 'reconcileStructure').mockResolvedValue(result);
    const knowledge = new Knowledge({
      storage,
      structure: { scopes: [{ address: 'org:acme', name: 'Acme' }] },
    });

    new Mastra({ knowledge: { default: knowledge }, logger: false });

    await expect(Promise.all([knowledge.reconcile(), knowledge.reconcile()])).resolves.toEqual([result, result]);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('applies structured plans with the v2 in-memory storage', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'in-memory-structure' }),
      structure: { scopes: [{ address: 'org:acme', name: 'Acme' }] },
    });

    const first = await knowledge.reconcile();
    const second = await knowledge.reconcile();
    const lazy = await knowledge.materializeScope({
      address: 'resource:mastra',
      contextualScopeAddress: 'org:acme',
      parameters: { resourceId: 'mastra' },
    });

    expect(first).toMatchObject({ changed: true, accessEpoch: 1 });
    expect(second).toMatchObject({ changed: false, accessEpoch: 1, scopes: first.scopes });
    expect(lazy).toMatchObject({ changed: true, accessEpoch: 2 });
  });

  it('coalesces concurrent lazy materialization for one concrete address', async () => {
    const storage = new InMemoryStore({ id: 'lazy-structured' });
    const domain = storage.stores.knowledge!;
    vi.spyOn(domain, 'getCapabilities').mockReturnValue({
      contractVersion: 2,
      schemaVersion: 2,
      supportsV2: true,
      supportsExplicitReset: true,
    });
    const result = { scopes: { 'org:acme': 'scope-id' }, createdScopeIds: ['scope-id'], changed: true, accessEpoch: 1 };
    const reconcile = vi.spyOn(domain, 'reconcileStructure').mockResolvedValue(result);
    const knowledge = new Knowledge({ storage });
    const input = { address: 'org:acme', contextualScopeAddress: 'org:acme', parameters: { orgId: 'acme' } };

    const first = knowledge.materializeScope(input);
    const second = knowledge.materializeScope(input);
    const conflicting = knowledge.materializeScope({ ...input, name: 'Other Acme' });

    await expect(conflicting).rejects.toThrow('Conflicting materialization is already in progress');
    await expect(Promise.all([first, second])).resolves.toEqual([result, result]);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('registers default and named instances without eagerly initializing storage', async () => {
    const defaultStorage = new InMemoryStore({ id: 'default-knowledge' });
    const analyticsStorage = new InMemoryStore({ id: 'analytics-knowledge' });
    const defaultInit = vi.spyOn(defaultStorage, 'init');
    const analyticsInit = vi.spyOn(analyticsStorage, 'init');
    const defaultKnowledge = new Knowledge({ id: 'default-instance', storage: defaultStorage });
    const analytics = new Knowledge({ id: 'analytics-instance', storage: analyticsStorage });

    const mastra = new Mastra({
      knowledge: { default: defaultKnowledge, analytics },
      logger: false,
    });

    expect(mastra.getKnowledge('default')).toBe(defaultKnowledge);
    expect(mastra.getKnowledge('analytics')).toBe(analytics);
    expect(mastra.listKnowledge()).toEqual({ default: defaultKnowledge, analytics });
    expect(defaultInit).not.toHaveBeenCalled();
    expect(analyticsInit).not.toHaveBeenCalled();

    await Promise.all([defaultKnowledge.getStorage(), defaultKnowledge.getStorage()]);
    expect(defaultInit).toHaveBeenCalledTimes(1);
    expect(analyticsInit).not.toHaveBeenCalled();
  });

  it('keeps instances with separate storage backends isolated', async () => {
    const first = new Knowledge({ storage: new InMemoryStore({ id: 'first' }) });
    const second = new Knowledge({ storage: new InMemoryStore({ id: 'second' }) });

    const node = await first.createNode({ id: 'shared-id', name: 'First', kind: 'topic', scope });

    expect(node.id).toBe('shared-id');
    await expect(second.getNode('shared-id')).resolves.toBeNull();
  });

  it('inherits Mastra storage only when the instance has no storage', async () => {
    const storage = new InMemoryStore({ id: 'shared' });
    const inherited = new Knowledge({ id: 'inherited' });
    const ownedStorage = new InMemoryStore({ id: 'owned' });
    const owned = new Knowledge({ id: 'owned', storage: ownedStorage });
    const mastra = new Mastra({ storage, knowledge: { inherited, owned }, logger: false });

    expect(await inherited.getStorage()).toBe(await storage.getStore('knowledge'));
    expect(await owned.getStorage()).toBe(await ownedStorage.getStore('knowledge'));
    expect(mastra.getKnowledge('inherited')).toBe(inherited);
  });

  it('initializes registries before editor registration can replace storage', () => {
    const replacement = new InMemoryStore({ id: 'editor-storage' });
    const editor = {
      registerWithMastra(mastra: Mastra) {
        mastra.setStorage(replacement);
      },
    } as unknown as NonNullable<ConstructorParameters<typeof Mastra>[0]>['editor'];

    const mastra = new Mastra({ editor, logger: false });

    expect(mastra.getStorage()?.id).toBe('editor-storage');
    expect(mastra.listKnowledge()).toEqual({});
  });

  it('fails explicitly for missing and duplicate registration keys', () => {
    const mastra = new Mastra({ logger: false });
    const first = new Knowledge({ id: 'first', storage: new InMemoryStore() });

    expect(() => mastra.getKnowledge('missing')).toThrow('Knowledge with key missing not found');
    mastra.addKnowledge(first, 'shared');
    expect(() => mastra.addKnowledge(new Knowledge({ id: 'second', storage: new InMemoryStore() }), 'shared')).toThrow(
      'Knowledge with key shared is already registered',
    );
  });

  it('rejects multiple instances inheriting one Mastra storage backend', () => {
    expect(
      () =>
        new Mastra({
          knowledge: {
            default: new Knowledge({ id: 'default' }),
            analytics: new Knowledge({ id: 'analytics' }),
          },
          logger: false,
        }),
    ).toThrow('Knowledge instances cannot share a storage backend');
  });

  it('rejects multiple instances configured with the same storage object', () => {
    const storage = new InMemoryStore();

    expect(
      () =>
        new Mastra({
          knowledge: {
            default: new Knowledge({ id: 'default', storage }),
            analytics: new Knowledge({ id: 'analytics', storage }),
          },
          logger: false,
        }),
    ).toThrow('Knowledge instances cannot share a storage backend');
  });

  it('rejects different composite stores that resolve to the same Knowledge domain', () => {
    const storage = new InMemoryStore();
    const first = new MastraCompositeStore({ id: 'first-wrapper', default: storage });
    const second = new MastraCompositeStore({ id: 'second-wrapper', default: storage });

    expect(
      () =>
        new Mastra({
          knowledge: {
            default: new Knowledge({ id: 'default', storage: first }),
            analytics: new Knowledge({ id: 'analytics', storage: second }),
          },
          logger: false,
        }),
    ).toThrow('Knowledge instances cannot share a storage backend');
  });

  it('rejects distinct domain objects that identify the same physical backend', () => {
    const firstStorage = new InMemoryStore();
    const secondStorage = new InMemoryStore();
    vi.spyOn(firstStorage.stores.knowledge!, 'getStorageIsolationKey').mockReturnValue('shared-backend');
    vi.spyOn(secondStorage.stores.knowledge!, 'getStorageIsolationKey').mockReturnValue('shared-backend');
    const first = new MastraCompositeStore({
      id: 'first-wrapper',
      domains: { knowledge: firstStorage.stores.knowledge },
    });
    const second = new MastraCompositeStore({
      id: 'second-wrapper',
      domains: { knowledge: secondStorage.stores.knowledge },
    });

    expect(
      () =>
        new Mastra({
          knowledge: {
            default: new Knowledge({ id: 'default', storage: first }),
            analytics: new Knowledge({ id: 'analytics', storage: second }),
          },
          logger: false,
        }),
    ).toThrow('Knowledge instances cannot share a storage backend');
  });

  it.each(['inherited-first', 'owned-first'])(
    'rejects own and inherited instances sharing Mastra storage (%s)',
    order => {
      const storage = new InMemoryStore();
      const inherited = new Knowledge({ id: 'inherited' });
      const owned = new Knowledge({ id: 'owned', storage });
      const knowledge = order === 'inherited-first' ? { inherited, owned } : { owned, inherited };

      expect(() => new Mastra({ storage, knowledge, logger: false })).toThrow(
        'Knowledge instances cannot share a storage backend',
      );
    },
  );

  it('rejects sharing through the augmented Mastra storage accessor', () => {
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      knowledge: { default: new Knowledge({ id: 'default' }) },
      logger: false,
    });

    expect(() =>
      mastra.addKnowledge(new Knowledge({ id: 'analytics', storage: mastra.getStorage()! }), 'analytics'),
    ).toThrow('Knowledge instances cannot share a storage backend');
  });

  it('updates inherited Knowledge when Mastra storage changes', async () => {
    const original = new InMemoryStore({ id: 'original' });
    const replacement = new InMemoryStore({ id: 'replacement' });
    const knowledge = new Knowledge({ id: 'default' });
    const mastra = new Mastra({ storage: original, knowledge: { default: knowledge }, logger: false });

    expect(await knowledge.getStorage()).toBe(await original.getStore('knowledge'));
    mastra.setStorage(replacement);
    expect(await knowledge.getStorage()).toBe(await replacement.getStore('knowledge'));
  });

  it('rejects a Mastra storage update that would merge Knowledge instances', () => {
    const replacement = new InMemoryStore({ id: 'replacement' });
    const mastra = new Mastra({
      knowledge: {
        default: new Knowledge({ id: 'default' }),
        analytics: new Knowledge({ id: 'analytics', storage: replacement }),
      },
      logger: false,
    });

    expect(() => mastra.setStorage(replacement)).toThrow(
      'Cannot set Mastra storage because a named Knowledge instance already uses that backend',
    );
  });

  it('rejects a Mastra storage wrapper that resolves to an owned Knowledge domain', () => {
    const storage = new InMemoryStore();
    const ownedWrapper = new MastraCompositeStore({ id: 'owned-wrapper', default: storage });
    const replacementWrapper = new MastraCompositeStore({ id: 'replacement-wrapper', default: storage });
    const mastra = new Mastra({
      knowledge: {
        default: new Knowledge({ id: 'default' }),
        analytics: new Knowledge({ id: 'analytics', storage: ownedWrapper }),
      },
      logger: false,
    });

    expect(() => mastra.setStorage(replacementWrapper)).toThrow(
      'Cannot set Mastra storage because a named Knowledge instance already uses that backend',
    );
  });

  it('retries initialization after failure and coalesces concurrent callers', async () => {
    const storage = new InMemoryStore();
    const originalInit = storage.init.bind(storage);
    const init = vi
      .spyOn(storage, 'init')
      .mockRejectedValueOnce(new Error('temporary init failure'))
      .mockImplementation(originalInit);
    const knowledge = new Knowledge({ storage });

    const first = knowledge.getStorage();
    const concurrent = knowledge.getStorage();
    await expect(first).rejects.toThrow('temporary init failure');
    await expect(concurrent).rejects.toThrow('temporary init failure');
    expect(init).toHaveBeenCalledTimes(1);

    await expect(knowledge.getStorage()).resolves.toBeDefined();
    expect(init).toHaveBeenCalledTimes(2);
  });

  it('respects disableInit and reports adapters without v2 capability', async () => {
    const disabledStorage = new InMemoryStore();
    disabledStorage.disableInit = true;
    const disabledInit = vi.spyOn(disabledStorage, 'init');
    await new Knowledge({ storage: disabledStorage }).getStorage();
    expect(disabledInit).not.toHaveBeenCalled();

    const unsupportedStorage = new InMemoryStore();
    const domain = unsupportedStorage.stores.knowledge!;
    vi.spyOn(domain, 'getCapabilities').mockReturnValue({
      contractVersion: 2,
      schemaVersion: 1,
      supportsV2: false,
      supportsSchemaInspection: false,
      supportsExplicitReset: false,
    });

    await expect(new Knowledge({ storage: unsupportedStorage }).getStorage()).rejects.toThrow(
      'supports schema version 1, but Knowledge requires schema version 2',
    );
  });
});
