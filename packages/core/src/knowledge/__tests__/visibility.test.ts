import { describe, expect, it } from 'vitest';
import { Knowledge } from '..';
import { InMemoryStore, knowledgeImporterBindingKey } from '../../storage';

describe('Knowledge strict read visibility', () => {
  it('resolves host-vouched scopes to a frontier before every read shape', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'strict-read-visibility' }) });
    const storage = await knowledge.getStorageInternal();
    const structure = await storage.reconcileStructure({
      scopes: [
        { address: 'principal:reader', name: 'Reader' },
        { address: 'principal:other', name: 'Other reader' },
        {
          address: 'scope:visible',
          name: 'Visible scope',
          grants: [{ scopeRefAddress: 'principal:reader', role: 'readonly' }],
        },
        {
          address: 'scope:hidden',
          name: 'Hidden scope',
          grants: [{ scopeRefAddress: 'principal:other', role: 'readonly' }],
        },
      ],
    });
    const principal = structure.scopes['principal:reader']!;
    const visibleScope = structure.scopes['scope:visible']!;
    const hiddenScope = structure.scopes['scope:hidden']!;

    const visibleNode = await storage.createNode({ name: 'Visible result', scopeIds: [visibleScope] });
    const hiddenNode = await storage.createNode({ name: 'Hidden result', scopeIds: [hiddenScope] });
    const secret = await storage.createNode({ name: 'Secret target', scopeIds: [hiddenScope] });
    const visibleRecord = await storage.createRecord({
      node: visibleNode,
      text: 'Visible record',
      scopeIds: [visibleScope],
      contextScopeId: visibleScope,
    });
    await storage.createRecord({
      node: visibleNode,
      text: 'Mentions [[Secret target]]',
      scopeIds: [visibleScope],
      resolutionScopeIds: [visibleScope, hiddenScope],
      contextScopeId: visibleScope,
    });
    await storage.createRecord({
      node: hiddenNode,
      text: 'Hidden record',
      scopeIds: [hiddenScope],
      contextScopeId: hiddenScope,
    });
    const currentVisibleNode = await storage.getNode(visibleNode.id);

    await expect(knowledge.getNode({ id: visibleNode.id, scopeIds: [principal] })).resolves.toEqual(currentVisibleNode);
    await expect(knowledge.getNode({ id: hiddenNode.id, scopeIds: [principal] })).resolves.toBeNull();
    await expect(knowledge.getNode({ id: hiddenScope, scopeIds: [hiddenScope] })).resolves.toBeNull();

    await expect(knowledge.listNodes({ scopeIds: [principal], namePrefix: '', limit: 1 })).resolves.toEqual([
      currentVisibleNode,
    ]);
    await expect(knowledge.search({ query: 'result', scopeIds: [principal], limit: 10 })).resolves.toEqual([
      expect.objectContaining({ id: visibleNode.id }),
    ]);

    await expect(knowledge.listRecords({ node: visibleNode, scopeIds: [principal] })).resolves.toEqual({
      records: [visibleRecord],
      nextCursor: undefined,
    });
    await expect(knowledge.getRecord({ id: visibleRecord.id, scopeIds: [principal] })).resolves.toEqual(visibleRecord);
    await expect(knowledge.listMentioningRecords({ node: secret, scopeIds: [principal] })).resolves.toEqual({
      records: [],
      nextCursor: undefined,
    });

    knowledge.registerImporter({ id: 'reader-importer', handler: async () => {} });
    const visibleBinding = knowledgeImporterBindingKey({ source: 'source:visible', scope: 'scope:visible' });
    const hiddenBinding = knowledgeImporterBindingKey({ source: 'source:hidden', scope: 'scope:hidden' });
    const visibleRun = await knowledge.createImportRun({
      id: 'visible-run',
      importerId: 'reader-importer',
      binding: visibleBinding,
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    await knowledge.createImportRun({
      id: 'hidden-run',
      importerId: 'reader-importer',
      binding: hiddenBinding,
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    await storage.createImportRun({
      id: 'orphaned-hidden-run',
      importerId: 'removed-importer',
      binding: hiddenBinding,
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    await knowledge.setImportState({
      importerId: 'reader-importer',
      binding: visibleBinding,
      key: 'cursor',
      value: '1',
    });
    await knowledge.setImportState({
      importerId: 'reader-importer',
      binding: hiddenBinding,
      key: 'cursor',
      value: '2',
    });

    await expect(knowledge.getImportRun({ id: visibleRun.id, scopeIds: [principal] })).resolves.toEqual(visibleRun);
    await expect(knowledge.getImportRun({ id: 'hidden-run', scopeIds: [principal] })).resolves.toBeNull();
    await expect(knowledge.listImportRuns({ scopeIds: [principal], limit: 1 })).resolves.toEqual({
      runs: [visibleRun],
      nextCursor: undefined,
    });
    await expect(
      knowledge.getImportState({
        importerId: 'reader-importer',
        binding: visibleBinding,
        key: 'cursor',
        scopeIds: [principal],
      }),
    ).resolves.toMatchObject({ value: '1' });
    await expect(
      knowledge.getImportState({
        importerId: 'reader-importer',
        binding: hiddenBinding,
        key: 'cursor',
        scopeIds: [principal],
      }),
    ).resolves.toBeNull();
    await expect(
      knowledge.listActivity({ scopeIds: [principal], importRunId: 'orphaned-hidden-run', limit: 100 }),
    ).resolves.toEqual([]);

    const activity = await knowledge.listActivity({ scopeIds: [principal], limit: 100 });
    expect(activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetType: 'node', targetId: visibleNode.id }),
        expect.objectContaining({ targetType: 'record', targetId: visibleRecord.id }),
      ]),
    );
    expect(activity.some(event => event.targetId === hiddenNode.id || event.targetId === secret.id)).toBe(false);

    await storage.reconcileStructure({
      scopes: [
        {
          address: 'scope:visible',
          name: 'Visible scope',
          grants: [{ scopeRefAddress: 'principal:other', role: 'readonly' }],
        },
      ],
    });
    await expect(knowledge.getNode({ id: visibleNode.id, scopeIds: [principal] })).resolves.toBeNull();
    await expect(knowledge.listRecords({ node: visibleNode, scopeIds: [principal] })).resolves.toEqual({
      records: [],
      nextCursor: undefined,
    });
  });
});
