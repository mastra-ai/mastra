import { describe, expect, it } from 'vitest';
import {
  InMemoryStore,
  knowledgeImporterBindingKey,
  knowledgeImportNodeAddress,
  knowledgeImportStoredRecordId,
} from '../../../storage';
import { Knowledge } from '../../index';
import { createStaticKnowledgeImporterOperations } from '../static-importer';

const source = 'google-calendar:primary';
const scopeAddress = 'project:mastra';
const binding = knowledgeImporterBindingKey({ source, scope: scopeAddress });
/** Imported identity is per destination: storage holds this binding's node address and record ids. */
const address = (value: string) => knowledgeImportNodeAddress(scopeAddress, value);
const stored = (id: string) => knowledgeImportStoredRecordId({ importerId: 'calendar', binding }, id);

async function createFixture(role: 'append' | 'edit' | 'owner' = 'edit') {
  const knowledge = new Knowledge({
    storage: new InMemoryStore({ id: `static-import-${role}` }),
    structure: {
      scopes: [
        { address: 'org:acme', name: 'Acme' },
        { address: scopeAddress, name: 'Mastra', parentAddresses: ['org:acme'] },
      ],
    },
    importers: [
      {
        id: 'calendar',
        access: { 'org:acme': 'readonly', 'project:$projectId': role },
        handler: async () => {},
      },
    ],
  });
  const storage = await knowledge.getStorage();
  const scopes = (await knowledge.reconcile()).scopes;
  const orgScopeId = scopes['org:acme']!;
  const projectScopeId = scopes[scopeAddress]!;
  const queuedRun = await knowledge.createImportRun({
    importerId: 'calendar',
    binding,
    importKind: 'static',
    triggerKind: 'programmatic',
  });
  const run = await knowledge.updateImportRun({ id: queuedRun.id, status: 'running' });
  const operations = await createStaticKnowledgeImporterOperations({
    knowledge,
    importerId: 'calendar',
    source,
    scopeAddress,
    importRunId: run.id,
  });
  return { knowledge, operations, run, orgScopeId, projectScopeId };
}

describe('static Knowledge importer operations', () => {
  it('does not expose an ad-hoc handle constructor on Knowledge', () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'no-ad-hoc-importer-handle' }) });
    expect('createStaticImporterOperations' in knowledge).toBe(false);
  });

  it('upserts deterministic external addresses idempotently', async () => {
    const { knowledge, operations, run, projectScopeId } = await createFixture();
    const first = await operations.upsertNode('event:42', {
      scopes: [operations.scope],
      name: 'Architecture review',
      metadata: { agenda: 'Initial' },
    });
    const replayed = await operations.upsertNode('event:42', {
      scopes: [operations.scope],
      name: 'Architecture review',
      metadata: { agenda: 'Initial' },
    });
    const updated = await operations.upsertNode('event:42', {
      scopes: [operations.scope],
      name: 'Architecture review',
      metadata: { agenda: 'Updated' },
    });

    expect(replayed.node).toEqual(first.node);
    expect(updated.node).toMatchObject({ id: first.id, version: 2, metadata: { agenda: 'Updated' } });
    expect((await operations.getNode('event:42'))?.node).toEqual(updated.node);
    expect((await operations.listNodes()).map(handle => handle.node)).toEqual([updated.node]);
    expect(await knowledge.listActivity({ scopeIds: [projectScopeId], importRunId: run.id })).toEqual([
      expect.objectContaining({ action: 'edit', targetId: first.id, importRunId: run.id }),
      expect.objectContaining({ action: 'create', targetId: first.id, importRunId: run.id }),
    ]);
    expect(await (await knowledge.getStorage()).getNodeScopeIds(first.id)).toEqual([projectScopeId]);
  });

  it('keeps distinct addresses that share a title as distinct nodes', async () => {
    const { operations } = await createFixture();
    const first = await operations.upsertNode('event:100', { scopes: [operations.scope], name: 'Dynamic Workflows' });
    const second = await operations.upsertNode('event:200', { scopes: [operations.scope], name: 'Dynamic Workflows' });

    expect(second.id).not.toBe(first.id);
    expect(first.node.name).toBe('Dynamic Workflows');
    expect(second.node.name).toBe('Dynamic Workflows (ent200)');
    expect(
      (await operations.upsertNode('event:100', { scopes: [operations.scope], name: 'Dynamic Workflows' })).node,
    ).toEqual(first.node);
    expect(
      (await operations.upsertNode('event:200', { scopes: [operations.scope], name: 'Dynamic Workflows' })).node,
    ).toEqual(second.node);

    const updated = await operations.upsertNode('event:200', {
      scopes: [operations.scope],
      name: 'Dynamic Workflows',
      metadata: { v: 2 },
    });
    expect(updated.node).toMatchObject({ id: second.id, name: 'Dynamic Workflows (ent200)', metadata: { v: 2 } });
  });

  it('uses ordinary records with source provenance and binding-bounded removal', async () => {
    const { knowledge, operations, run, orgScopeId, projectScopeId } = await createFixture('owner');
    const node = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
    const otherNode = await operations.upsertNode('event:43', { scopes: [operations.scope], name: 'Retro' });
    const imported = await node.appendKnowledge({ id: 'record-imported', text: '10:00–11:00' });
    const otherImported = await otherNode.appendKnowledge({ id: 'record-other', text: '15:00–16:00' });
    const foreign = await knowledge.createRecord({
      id: 'record-curated',
      node: node.id,
      text: 'Curator note',
      scopeIds: [projectScopeId],
      source: 'curator',
      importRunId: run.id,
    });

    expect(await node.listKnowledge()).toEqual([expect.objectContaining({ id: imported.id, source })]);
    const broadened = await node.appendKnowledge({ id: 'record-broadened', text: 'Shared with another scope' });
    await knowledge.setRecordScopes({
      id: stored(broadened.id),
      version: broadened.version,
      scopeIds: [projectScopeId, orgScopeId],
    });
    expect(await node.listKnowledge()).toEqual([expect.objectContaining({ id: imported.id, source })]);
    await expect(node.removeKnowledge(foreign.id)).rejects.toThrow('owned by another binding');
    await expect(node.removeKnowledge(otherImported.id)).rejects.toThrow('owned by another binding');
    // Broadened outside the importer: no longer importer-owned, so removal skips it.
    expect(await node.removeKnowledge(broadened.id)).toBeNull();
    expect(await node.removeKnowledge(imported.id)).toEqual(imported);
    expect(await node.removeKnowledge(imported.id)).toBeNull();
    expect(await knowledge.getRecord({ id: stored(imported.id), includeDeleted: true })).toBeNull();
    expect(await knowledge.getRecord({ id: foreign.id })).toEqual(foreign);

    const externallyEdited = await node.appendKnowledge({ id: 'record-edited', text: 'Importer-owned before edit' });
    const edited = await knowledge.setRecordScopes({
      id: stored(externallyEdited.id),
      version: externallyEdited.version,
      scopeIds: [projectScopeId],
    });
    expect(await node.removeKnowledge(externallyEdited.id)).toBeNull();
    expect(await knowledge.getRecord({ id: edited.id })).toEqual(edited);
    expect(await knowledge.listActivity({ scopeIds: [projectScopeId], importRunId: run.id })).toContainEqual(
      expect.objectContaining({
        action: 'skip',
        targetType: 'record',
        targetId: edited.id,
        details: expect.objectContaining({ reason: 'ownership-changed', source }),
      }),
    );
  });

  it('keeps record ownership across importer-owned node updates without claiming external edits', async () => {
    const { knowledge, operations, projectScopeId } = await createFixture('owner');
    const node = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
    const owned = await node.appendKnowledge({ id: 'record-owned', text: 'Revision one' });
    const externallyEdited = await node.appendKnowledge({ id: 'record-edited', text: 'Importer-owned before edit' });
    const edited = await knowledge.setRecordScopes({
      id: stored(externallyEdited.id),
      version: externallyEdited.version,
      scopeIds: [projectScopeId],
    });

    const updated = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning updated' });

    expect(await updated.removeKnowledge(owned.id)).toMatchObject({ id: owned.id });
    expect(await knowledge.getRecord({ id: stored(owned.id), includeDeleted: true })).toBeNull();
    expect(await updated.removeKnowledge(externallyEdited.id)).toBeNull();
    expect(await knowledge.getRecord({ id: edited.id })).toMatchObject({ id: edited.id });
  });

  it('keeps record ownership across node updates without tracking state outside the write', async () => {
    const { knowledge, operations } = await createFixture('owner');
    const node = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
    const owned = await node.appendKnowledge({ id: 'record-owned', text: 'Revision one' });
    const setImportState = knowledge.setImportState.bind(knowledge);
    let separateWrites = 0;
    knowledge.setImportState = async input => {
      separateWrites++;
      return setImportState(input);
    };

    // Claims advance in the same storage write as the node update, so there is no window to interrupt.
    const updated = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning updated' });
    knowledge.setImportState = setImportState;
    expect(separateWrites).toBe(0);
    expect(await updated.removeKnowledge(owned.id)).toMatchObject({ id: owned.id });
    expect(await knowledge.getRecord({ id: stored(owned.id), includeDeleted: true })).toBeNull();
  });

  it('keeps reads scoped to the runtime destination binding', async () => {
    const { knowledge, operations, orgScopeId } = await createFixture('owner');
    const node = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
    const otherScopeId = '10000000-0000-4000-8000-000000000003';
    const storage = await knowledge.getStorage();
    await storage.createNode({ id: otherScopeId, name: 'Other', isScope: true, scopeIds: [orgScopeId] });
    await knowledge.updateNode({ id: node.id, version: node.node.version, scopeIds: [otherScopeId] });

    expect(await operations.getNode('event:42')).toBeNull();
    expect(await operations.listNodes()).toEqual([]);
    await expect(node.appendKnowledge({ text: 'Must not cross bindings' })).rejects.toThrow(
      'not owned by this importer binding',
    );
  });

  it('physically removes owned content but preserves foreign and broadened content', async () => {
    const { knowledge, operations, orgScopeId, projectScopeId } = await createFixture('owner');
    const handle = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
    const imported = await handle.appendKnowledge({ text: 'Imported details' });
    const broadened = await handle.appendKnowledge({ text: 'Broadened imported details' });
    await knowledge.setRecordScopes({
      id: broadened.id,
      version: broadened.version,
      scopeIds: [projectScopeId, orgScopeId],
    });
    const foreign = await knowledge.createRecord({
      node: handle.id,
      text: 'Curated details',
      scopeIds: [projectScopeId],
      source: 'curator',
    });

    const result = await operations.removeNode('event:42');
    expect(result).toMatchObject({ node: { id: handle.id }, recordsRemoved: 1 });
    expect(await knowledge.getRecord({ id: imported.id, includeDeleted: true })).toBeNull();
    expect(await knowledge.getRecord({ id: broadened.id })).toEqual(
      expect.objectContaining({ id: broadened.id, text: broadened.text }),
    );
    expect(await knowledge.getRecord({ id: foreign.id })).toEqual(foreign);
    expect(await knowledge.getNode(handle.id)).not.toBeNull();
    // Nodes are never deleted, so removing again finds the node with nothing left to remove.
    expect(await operations.removeNode('event:42')).toMatchObject({ node: { id: handle.id }, recordsRemoved: 0 });
  });

  it('does not remove or overwrite nodes changed outside the importer', async () => {
    const { knowledge, operations, projectScopeId } = await createFixture('owner');
    const handle = await operations.upsertNode('event:42', {
      scopes: [operations.scope],
      name: 'Planning',
      metadata: { agenda: 'Imported' },
    });
    const movedScopeId = '10000000-0000-4000-8000-000000000004';
    await (
      await knowledge.getStorage()
    ).createNode({
      id: movedScopeId,
      name: 'Curated thread',
      isScope: true,
      scopeIds: [projectScopeId],
    });
    const moved = await knowledge.updateNode({
      id: handle.id,
      version: handle.node.version,
      scopeIds: [movedScopeId],
    });

    await expect(
      operations.upsertNode('event:42', {
        scopes: [operations.scope],
        name: 'Planning',
        metadata: { agenda: 'Imported' },
      }),
    ).rejects.toThrow('changed outside importer calendar');
    expect(await operations.removeNode('event:42')).toEqual({ node: moved, recordsRemoved: 0 });
    expect(await (await knowledge.getStorage()).getNodeAddress({ source, address: address('event:42') })).toMatchObject(
      {
        nodeId: handle.id,
      },
    );
    expect(await knowledge.listActivity({ scopeIds: [projectScopeId, movedScopeId] })).toContainEqual(
      expect.objectContaining({
        action: 'skip',
        targetType: 'node',
        targetId: handle.id,
        details: expect.objectContaining({ reason: 'ownership-changed', source, address: 'event:42' }),
      }),
    );
  });

  it('enforces append authority and active binding runs', async () => {
    const { knowledge, operations, run } = await createFixture('append');
    const node = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
    const record = await node.appendKnowledge({ text: 'Imported details' });

    await expect(node.removeKnowledge(record.id)).rejects.toThrow('owner authority');
    await knowledge.updateImportRun({ id: run.id, status: 'succeeded' });
    await expect(operations.getNode('event:42')).rejects.toThrow('is not active');
    await expect(operations.listNodes()).rejects.toThrow('is not active');
    await expect(node.listKnowledge()).rejects.toThrow('is not active');
    await expect(operations.upsertNode('event:44', { scopes: [operations.scope], name: 'Closed run' })).rejects.toThrow(
      'is not active',
    );

    await expect(
      createStaticKnowledgeImporterOperations({
        knowledge,
        importerId: 'calendar',
        source: 'google-calendar:forged',
        scopeAddress,
        importRunId: run.id,
      }),
    ).rejects.toThrow('is not active');
  });

  describe('stable record ids', () => {
    it('treats an identical re-emission as a no-op', async () => {
      const { knowledge, operations } = await createFixture();
      const node = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
      const input = { id: 'event-42-time', text: '10:00-11:00', metadata: { tz: 'UTC' } };
      const first = await node.appendKnowledge(input);

      await expect(node.appendKnowledge(input)).resolves.toEqual(first);
      expect(await knowledge.getRecord({ id: stored(input.id) })).toEqual({ ...first, id: stored(input.id) });
    });

    it('compares re-emitted metadata independent of key order', async () => {
      const { operations } = await createFixture();
      const node = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
      const first = await node.appendKnowledge({
        id: 'event-42-time',
        text: '10:00-11:00',
        metadata: { zeta: 1, tz: 'UTC', alpha: { b: 2, a: 1 } },
      });

      await expect(
        node.appendKnowledge({
          id: 'event-42-time',
          text: '10:00-11:00',
          metadata: { alpha: { a: 1, b: 2 }, tz: 'UTC', zeta: 1 },
        }),
      ).resolves.toEqual(first);
    });

    it('does not resurrect an imported record someone deleted', async () => {
      const { knowledge, operations } = await createFixture();
      const node = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
      await node.appendKnowledge({ id: 'event-42-time', text: '10:00-11:00' });
      await knowledge.deleteRecord({ id: stored('event-42-time'), deletedBy: 'reviewer' });

      await node.appendKnowledge({ id: 'event-42-time', text: '10:00-11:00' });

      expect(await knowledge.getRecord({ id: stored('event-42-time') })).toBeNull();
      expect(await knowledge.getRecord({ id: stored('event-42-time'), includeDeleted: true })).toMatchObject({
        deletedAt: expect.any(Date),
      });
    });

    it('rejects different content for an existing record id without overwriting it', async () => {
      const { knowledge, operations } = await createFixture();
      const node = await operations.upsertNode('event:42', { scopes: [operations.scope], name: 'Planning' });
      const first = await node.appendKnowledge({ id: 'event-42-time', text: '10:00-11:00' });

      await expect(node.appendKnowledge({ id: 'event-42-time', text: '14:00-15:00' })).rejects.toThrow(
        'Knowledge record event-42-time already exists with different content',
      );
      expect(await knowledge.getRecord({ id: stored('event-42-time') })).toEqual({
        ...first,
        id: stored('event-42-time'),
      });
    });
  });

  describe('node scopes', () => {
    async function createScopedFixture() {
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: `static-import-scoped-${Math.random()}` }),
        structure: {
          scopes: [
            { address: 'org:acme', name: 'Acme' },
            { address: scopeAddress, name: 'Mastra', parentAddresses: ['org:acme'] },
            { address: 'area:docs', name: 'Docs', parentAddresses: [scopeAddress] },
            { address: 'area:sales', name: 'Sales', parentAddresses: ['org:acme'] },
            { address: 'project:other', name: 'Other', parentAddresses: ['org:acme'] },
          ],
        },
        importers: [
          {
            id: 'calendar',
            access: { 'org:acme': 'readonly', 'project:$projectId': 'owner', 'area:$area': 'owner' },
            handler: async () => {},
          },
        ],
      });
      const scopes = (await knowledge.reconcile()).scopes;
      const queued = await knowledge.createImportRun({
        importerId: 'calendar',
        binding,
        importKind: 'static',
        triggerKind: 'programmatic',
      });
      const run = await knowledge.updateImportRun({ id: queued.id, status: 'running' });
      const operations = await createStaticKnowledgeImporterOperations({
        knowledge,
        importerId: 'calendar',
        source,
        scopeAddress,
        importRunId: run.id,
      });
      return { knowledge, storage: await knowledge.getStorage(), operations, scopes };
    }

    it('places a node in several scopes under the binding', async () => {
      const { storage, operations, scopes } = await createScopedFixture();
      const node = await operations.upsertNode('event:1', { name: 'Launch', scopes: [scopeAddress, 'area:docs'] });
      expect(await storage.getNodeScopeIds(node.id)).toEqual([scopes[scopeAddress]!, scopes['area:docs']!].sort());
      const record = await node.appendKnowledge({ id: 'launch-1', text: 'Launch is Tuesday' });
      expect(await storage.getRecordScopeIds(stored(record.id))).toEqual(
        [scopes[scopeAddress]!, scopes['area:docs']!].sort(),
      );
      const narrow = await node.appendKnowledge({ id: 'launch-2', text: 'Docs freeze Monday', scopes: ['area:docs'] });
      expect(await storage.getRecordScopeIds(stored(narrow.id))).toEqual([scopes['area:docs']!]);
    });

    it('rejects scopes outside the binding before writing anything', async () => {
      const { storage, operations } = await createScopedFixture();
      for (const outside of ['project:other', 'area:sales', 'org:acme', 'area:missing']) {
        await expect(operations.upsertNode('event:1', { name: 'Launch', scopes: [outside] })).rejects.toThrow(
          `cannot write to scope ${outside}`,
        );
      }
      await expect(operations.upsertNode('event:1', { name: 'Launch', scopes: [] })).rejects.toThrow(
        'must name at least one scope',
      );
      expect(await storage.getNodeAddress({ source, address: address('event:1') })).toBeNull();
      const node = await operations.upsertNode('event:1', { name: 'Launch', scopes: [scopeAddress] });
      await expect(node.appendKnowledge({ text: 'Widened', scopes: ['area:docs'] })).rejects.toThrow(
        'subset of the node scopes',
      );
    });

    it('imports a scope node and nests other imported nodes under it', async () => {
      const { storage, operations, scopes } = await createScopedFixture();
      const space = await operations.upsertNode('space:eng', {
        name: 'Engineering',
        scopes: [scopeAddress],
        isScope: true,
      });
      expect(space.node.isScope).toBe(true);
      const page = await operations.upsertNode('page:1', { name: 'Runbook', scopes: [scopeAddress, 'space:eng'] });
      expect(await storage.getNodeScopeIds(page.id)).toEqual([scopes[scopeAddress]!, space.id].sort());
      // A same-source node that is not a scope cannot hold members.
      await operations.upsertNode('page:2', { name: 'Notes', scopes: [scopeAddress] });
      await expect(operations.upsertNode('page:3', { name: 'Child', scopes: ['page:2'] })).rejects.toThrow(
        'cannot write to scope page:2',
      );
    });

    it('updates membership on re-import and keeps the node when the provider deletes it', async () => {
      const { knowledge, storage, operations, scopes } = await createScopedFixture();
      const node = await operations.upsertNode('event:1', { name: 'Launch', scopes: [scopeAddress, 'area:docs'] });
      const record = await node.appendKnowledge({ id: 'launch-1', text: 'Launch is Tuesday' });
      const moved = await operations.upsertNode('event:1', { name: 'Launch', scopes: ['area:docs'] });
      expect(await storage.getNodeScopeIds(moved.id)).toEqual([scopes['area:docs']!]);
      // A membership change never bumps record versions, so the binding still owns its record.
      expect((await knowledge.getRecord({ id: stored(record.id) }))!.version).toBe(record.version);

      expect(await operations.removeNode('event:1')).toMatchObject({ recordsRemoved: 1 });
      expect(await knowledge.getRecord({ id: stored(record.id) })).toBeNull();
      expect((await knowledge.getNode(node.id))?.deletedAt).toBeUndefined();
      expect(await storage.getNodeAddress({ source, address: address('event:1') })).toMatchObject({ nodeId: node.id });
    });

    it('rejects an outside membership edit instead of overwriting it', async () => {
      const { knowledge, storage, operations, scopes } = await createScopedFixture();
      const node = await operations.upsertNode('event:1', { name: 'Launch', scopes: [scopeAddress] });
      await knowledge.updateNode({ id: node.id, version: node.node.version, scopeIds: [scopes['area:docs']!] });
      await expect(operations.upsertNode('event:1', { name: 'Launch', scopes: [scopeAddress] })).rejects.toThrow(
        'changed outside importer calendar',
      );
      expect(await storage.getNodeScopeIds(node.id)).toEqual([scopes['area:docs']!]);
    });
  });
});
