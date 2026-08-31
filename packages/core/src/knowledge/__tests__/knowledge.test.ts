import { describe, expect, it, vi } from 'vitest';
import { ConsoleLogger } from '../../logger';
import { Mastra } from '../../mastra';
import { InMemoryStore, MastraCompositeStore } from '../../storage';
import { Knowledge } from '../index';

const scopeIds = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'];

describe('Knowledge', () => {
  it('rejects over-long scope descriptions at construction', () => {
    const storage = new InMemoryStore({ id: 'bounded' });
    const description = 'x'.repeat(401);
    expect(
      () =>
        new Knowledge({
          storage,
          structure: { scopes: [{ address: 'scope:a', name: 'A', metadata: { description } }] },
        }),
    ).toThrow('Knowledge node description exceeds the 400 UTF-16 code unit limit');
    expect(() => new Knowledge({ storage, scopes: { 'team:$teamId': { description } } })).toThrow(
      'Knowledge node description exceeds the 400 UTF-16 code unit limit',
    );
  });

  it('reconciles configured structure in the background and coalesces explicit waits', async () => {
    const storage = new InMemoryStore({ id: 'structured' });
    const domain = storage.stores.knowledge!;
    vi.spyOn(domain, 'getCapabilities').mockReturnValue({
      contractVersion: 1,
      schemaVersion: 1,
      supported: true,
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

  it.each(['constructor', 'setLogger', 'addKnowledge'] as const)(
    'reports a failing startup reconcile to the Mastra logger via %s',
    async via => {
      const storage = new InMemoryStore({ id: 'failing-structure' });
      const error = new Error('reconcile failed');
      vi.spyOn(storage.stores.knowledge!, 'reconcileStructure').mockRejectedValue(error);
      const knowledge = new Knowledge({ storage, structure: { scopes: [{ address: 'org:acme', name: 'Acme' }] } });
      const logger = new ConsoleLogger({ level: 'warn' });
      vi.spyOn(logger, 'child').mockReturnValue(logger);
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      if (via === 'constructor') {
        new Mastra({ knowledge: { default: knowledge }, logger });
      } else if (via === 'setLogger') {
        new Mastra({ knowledge: { default: knowledge }, logger: false }).setLogger({ logger });
      } else {
        new Mastra({ logger }).addKnowledge(knowledge, 'default');
      }

      await vi.waitFor(() =>
        expect(warn).toHaveBeenCalledWith(
          'Knowledge startup reconciliation failed; durable importer runs remain recoverable',
          { error },
        ),
      );
    },
  );

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

  it('adds parent edges declared after first boot to existing static scopes', async () => {
    const storage = new InMemoryStore({ id: 'static-structure-growth' });
    const org = { address: 'org:acme', name: 'Acme' };
    const firstBoot = await new Knowledge({
      storage,
      structure: { scopes: [org, { address: 'team', name: 'Team' }] },
    }).reconcile();

    const secondBoot = await new Knowledge({
      storage,
      structure: { scopes: [org, { address: 'team', name: 'Team', parentAddresses: ['org:acme'] }] },
    }).reconcile();

    expect(secondBoot).toMatchObject({ changed: true, createdScopeIds: [] });
    expect(await storage.stores.knowledge!.getNodeScopeIds(firstBoot.scopes.team!)).toEqual([
      firstBoot.scopes['org:acme'],
    ]);
  });

  it('keeps materialized scopes as created when their scope type template changes', async () => {
    const storage = new InMemoryStore({ id: 'materialized-template-change' });
    const structure = { scopes: [{ address: 'org:acme', name: 'Acme' }] };
    const input = { address: 'project:atlas', contextualScopeAddress: 'org:acme', parentAddresses: ['org:acme'] };
    const before = new Knowledge({ storage, structure, scopes: { 'project:$projectId': { access: [] } } });
    await before.reconcile();
    const created = await before.materializeScope(input);

    const after = new Knowledge({
      storage,
      structure,
      scopes: { 'project:$projectId': { access: [{ principal: 'org:acme', role: 'readonly' }] } },
    });
    const rematerialized = await after.materializeScope(input);

    expect(rematerialized).toMatchObject({ changed: false, createdScopeIds: [], accessEpoch: created.accessEpoch });
  });

  it('creates templated child scopes for each materialized org', async () => {
    const storage = new InMemoryStore({ id: 'templated-children' });
    const knowledge = new Knowledge({
      storage,
      scopes: {
        'org:$orgId': {
          access: [{ principal: 'self', role: 'owner' }],
          children: [
            { address: '$self:about-me', name: 'About me' },
            { address: 'machines:$orgId', name: 'Machines', access: [{ principal: 'org:$orgId', role: 'readonly' }] },
          ],
        },
      },
    });

    const a = await knowledge.materializeScope({ address: 'org:a', contextualScopeAddress: 'org:a' });
    const b = await knowledge.materializeScope({ address: 'org:b', contextualScopeAddress: 'org:b' });

    expect(a.createdScopeIds).toHaveLength(3);
    expect(b.createdScopeIds).toHaveLength(3);
    const store = storage.stores.knowledge!;
    const parentsByAddress = Object.fromEntries(
      await Promise.all(
        ['org:a:about-me', 'machines:a', 'org:b:about-me', 'machines:b'].map(async address => {
          const scope = await store.getScopeAddress(address);
          return [address, scope ? await store.getNodeScopeIds(scope.scopeNodeId) : undefined];
        }),
      ),
    );
    expect(parentsByAddress).toEqual({
      'org:a:about-me': [a.scopes['org:a']],
      'machines:a': [a.scopes['org:a']],
      'org:b:about-me': [b.scopes['org:b']],
      'machines:b': [b.scopes['org:b']],
    });
    const machines = await store.getScopeAddress('machines:b');
    expect((await store.getNode(machines!.scopeNodeId))?.name).toBe('Machines');

    const again = await knowledge.materializeScope({ address: 'org:a', contextualScopeAddress: 'org:a' });
    expect(again).toMatchObject({ changed: false, createdScopeIds: [] });
  });

  it('does not add template children to a scope materialized before the template changed', async () => {
    const storage = new InMemoryStore({ id: 'templated-children-copy-on-create' });
    const input = { address: 'org:a', contextualScopeAddress: 'org:a' };
    const created = await new Knowledge({ storage }).materializeScope(input);

    const later = await new Knowledge({
      storage,
      scopes: { 'org:$orgId': { children: [{ address: '$self:shared', name: 'Shared' }] } },
    }).materializeScope(input);

    expect(later).toMatchObject({ changed: false, createdScopeIds: [], accessEpoch: created.accessEpoch });
    await expect(storage.stores.knowledge!.getScopeAddress('org:a:shared')).resolves.toBeNull();
  });

  it('keeps same-named scopes from different sources distinct by address across replays', async () => {
    const scopes = [
      { address: 'org:acme', name: 'Acme' },
      { address: 'repo:mastra', name: 'mastra', parentAddresses: ['org:acme'] },
      { address: 'repo:docs', name: 'docs', parentAddresses: ['org:acme'] },
      { address: 'repo:mastra:issues:42', name: 'Issue #42', parentAddresses: ['repo:mastra'] },
      { address: 'repo:docs:issues:42', name: 'Issue #42', parentAddresses: ['repo:docs'] },
    ];
    const storage = new InMemoryStore({ id: 'same-name-structure' });
    const first = await new Knowledge({ storage, structure: { scopes } }).reconcile();
    const replay = await new Knowledge({ storage, structure: { scopes } }).reconcile();

    const mastraIssue = first.scopes['repo:mastra:issues:42'];
    const docsIssue = first.scopes['repo:docs:issues:42'];
    expect(mastraIssue).toBeDefined();
    expect(docsIssue).toBeDefined();
    expect(mastraIssue).not.toBe(docsIssue);
    expect(replay).toMatchObject({ changed: false, scopes: first.scopes });
  });

  it('coalesces concurrent lazy materialization for one concrete address', async () => {
    const storage = new InMemoryStore({ id: 'lazy-structured' });
    const domain = storage.stores.knowledge!;
    vi.spyOn(domain, 'getCapabilities').mockReturnValue({
      contractVersion: 1,
      schemaVersion: 1,
      supported: true,
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

    await Promise.all([defaultKnowledge.getStorageInternal(), defaultKnowledge.getStorageInternal()]);
    expect(defaultInit).toHaveBeenCalledTimes(1);
    expect(analyticsInit).not.toHaveBeenCalled();
  });

  it('does not let callers replace registered instances through listKnowledge()', () => {
    const registered = new Knowledge({ id: 'registered', storage: new InMemoryStore({ id: 'registered' }) });
    const mastra = new Mastra({ knowledge: { default: registered }, logger: false });

    const listed = mastra.listKnowledge() as Record<string, Knowledge>;
    listed.default = new Knowledge({ id: 'replacement' });
    listed.extra = new Knowledge({ id: 'extra' });

    expect(mastra.getKnowledge('default')).toBe(registered);
    expect(Object.keys(mastra.listKnowledge())).toEqual(['default']);
  });

  it('keeps instances with separate storage backends isolated', async () => {
    const first = new Knowledge({ storage: new InMemoryStore({ id: 'first' }) });
    const second = new Knowledge({ storage: new InMemoryStore({ id: 'second' }) });
    const firstStorage = await first.getStorageInternal();
    await firstStorage.createNode({ id: scopeIds[0], name: 'Acme', isScope: true, scopeIds: [] });
    await firstStorage.createNode({ id: scopeIds[1], name: 'Mastra', isScope: true, scopeIds: [scopeIds[0]!] });

    const nodeId = '10000000-0000-4000-8000-000000000003';
    const node = await firstStorage.createNode({ id: nodeId, name: 'First', kind: 'topic', scopeIds });

    expect(node.id).toBe(nodeId);
    await expect(second.getNodeInternal(nodeId)).resolves.toBeNull();
  });

  it('inherits Mastra storage only when the instance has no storage', async () => {
    const storage = new InMemoryStore({ id: 'shared' });
    const inherited = new Knowledge({ id: 'inherited' });
    const ownedStorage = new InMemoryStore({ id: 'owned' });
    const owned = new Knowledge({ id: 'owned', storage: ownedStorage });
    const mastra = new Mastra({ storage, knowledge: { inherited, owned }, logger: false });

    expect(await inherited.getStorageInternal()).toBe(await storage.getStore('knowledge'));
    expect(await owned.getStorageInternal()).toBe(await ownedStorage.getStore('knowledge'));
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

    expect(await knowledge.getStorageInternal()).toBe(await original.getStore('knowledge'));
    mastra.setStorage(replacement);
    expect(await knowledge.getStorageInternal()).toBe(await replacement.getStore('knowledge'));
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

    const first = knowledge.getStorageInternal();
    const concurrent = knowledge.getStorageInternal();
    await expect(first).rejects.toThrow('temporary init failure');
    await expect(concurrent).rejects.toThrow('temporary init failure');
    expect(init).toHaveBeenCalledTimes(1);

    await expect(knowledge.getStorageInternal()).resolves.toBeDefined();
    expect(init).toHaveBeenCalledTimes(2);
  });

  it('respects disableInit and rejects unsupported adapters', async () => {
    const disabledStorage = new InMemoryStore();
    disabledStorage.disableInit = true;
    const disabledInit = vi.spyOn(disabledStorage, 'init');
    await new Knowledge({ storage: disabledStorage }).getStorageInternal();
    expect(disabledInit).not.toHaveBeenCalled();

    const unsupportedStorage = new InMemoryStore();
    const domain = unsupportedStorage.stores.knowledge!;
    vi.spyOn(domain, 'getCapabilities').mockReturnValue({
      contractVersion: 1,
      schemaVersion: null,
      supported: false,
    });

    await expect(new Knowledge({ storage: unsupportedStorage }).getStorageInternal()).rejects.toThrow(
      'InMemoryKnowledgeStorage does not support Knowledge.',
    );
  });
});
