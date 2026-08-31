import { describe, expect, it } from 'vitest';
import { InMemoryStore, knowledgeImporterBindingKey } from '../../../storage';
import { Knowledge } from '../../index';
import { createStaticKnowledgeImporterOperations } from '../static-importer';

const source = 'google-calendar:primary';
const scopeAddress = 'project:mastra';
const binding = knowledgeImporterBindingKey({ source, scope: scopeAddress });

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
  const storage = await knowledge.getStorageInternal();
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
      name: 'Architecture review',
      metadata: { agenda: 'Initial' },
    });
    const replayed = await operations.upsertNode('event:42', {
      name: 'Architecture review',
      metadata: { agenda: 'Initial' },
    });
    const updated = await operations.upsertNode('event:42', {
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
    expect(await (await knowledge.getStorageInternal()).getNodeScopeIds(first.id)).toEqual([projectScopeId]);
  });

  it('uses ordinary records with source provenance and binding-bounded removal', async () => {
    const { knowledge, operations, run, orgScopeId, projectScopeId } = await createFixture('owner');
    const node = await operations.upsertNode('event:42', { name: 'Planning' });
    const otherNode = await operations.upsertNode('event:43', { name: 'Retro' });
    const imported = await node.appendRecord({ id: 'record-imported', text: '10:00–11:00' });
    const otherImported = await otherNode.appendRecord({ id: 'record-other', text: '15:00–16:00' });
    const foreign = await (
      await knowledge.getStorageInternal()
    ).createRecord({
      id: 'record-curated',
      node: node.id,
      text: 'Curator note',
      scopeIds: [projectScopeId],
      source: 'curator',
      importRunId: run.id,
    });

    expect(await node.listRecords()).toEqual([expect.objectContaining({ id: imported.id, source })]);
    const broadened = await node.appendRecord({ id: 'record-broadened', text: 'Shared with another scope' });
    await (
      await knowledge.getStorageInternal()
    ).setRecordScopes({
      id: broadened.id,
      scopeIds: [projectScopeId, orgScopeId],
    });
    expect(await node.listRecords()).toEqual([expect.objectContaining({ id: imported.id, source })]);
    await expect(node.removeRecord(foreign.id)).rejects.toThrow('owned by another binding');
    await expect(node.removeRecord(otherImported.id)).rejects.toThrow('owned by another binding');
    await expect(node.removeRecord(broadened.id)).rejects.toThrow('owned by another binding');
    expect(await node.removeRecord(imported.id)).toEqual(imported);
    expect(await node.removeRecord(imported.id)).toBeNull();
    expect(await knowledge.getRecordInternal({ id: imported.id, includeDeleted: true })).toBeNull();
    expect(await knowledge.getRecordInternal({ id: foreign.id })).toEqual(foreign);
  });

  it('keeps reads scoped to the runtime destination binding', async () => {
    const { knowledge, operations, orgScopeId } = await createFixture('owner');
    const node = await operations.upsertNode('event:42', { name: 'Planning' });
    const otherScopeId = '10000000-0000-4000-8000-000000000003';
    const storage = await knowledge.getStorageInternal();
    await storage.createNode({ id: otherScopeId, name: 'Other', isScope: true, scopeIds: [orgScopeId] });
    await storage.updateNode({ id: node.id, version: node.node.version, scopeIds: [otherScopeId] });

    expect(await operations.getNode('event:42')).toBeNull();
    expect(await operations.listNodes()).toEqual([]);
    await expect(node.appendRecord({ text: 'Must not cross bindings' })).rejects.toThrow(
      'not owned by this importer binding',
    );
  });

  it('physically removes owned content but preserves foreign and broadened content', async () => {
    const { knowledge, operations, orgScopeId, projectScopeId } = await createFixture('owner');
    const handle = await operations.upsertNode('event:42', { name: 'Planning' });
    const imported = await handle.appendRecord({ text: 'Imported details' });
    const broadened = await handle.appendRecord({ text: 'Broadened imported details' });
    await (
      await knowledge.getStorageInternal()
    ).setRecordScopes({
      id: broadened.id,
      scopeIds: [projectScopeId, orgScopeId],
    });
    const foreign = await (
      await knowledge.getStorageInternal()
    ).createRecord({
      node: handle.id,
      text: 'Curated details',
      scopeIds: [projectScopeId],
      source: 'curator',
    });

    const result = await operations.removeNode('event:42');
    expect(result).toMatchObject({ node: { id: handle.id }, deleted: false });
    expect(await knowledge.getRecordInternal({ id: imported.id, includeDeleted: true })).toBeNull();
    expect(await knowledge.getRecordInternal({ id: broadened.id })).toEqual(
      expect.objectContaining({ id: broadened.id, text: broadened.text }),
    );
    expect(await knowledge.getRecordInternal({ id: foreign.id })).toEqual(foreign);
    expect(await knowledge.getNodeInternal(handle.id)).not.toBeNull();
    expect(await operations.removeNode('event:42')).toBeNull();
  });

  it('does not remove or overwrite nodes changed outside the importer', async () => {
    const { knowledge, operations, projectScopeId } = await createFixture('owner');
    const handle = await operations.upsertNode('event:42', {
      name: 'Planning',
      metadata: { agenda: 'Imported' },
    });
    const movedScopeId = '10000000-0000-4000-8000-000000000004';
    await (
      await knowledge.getStorageInternal()
    ).createNode({
      id: movedScopeId,
      name: 'Curated thread',
      isScope: true,
      scopeIds: [projectScopeId],
    });
    const moved = await (
      await knowledge.getStorageInternal()
    ).updateNode({
      id: handle.id,
      version: handle.node.version,
      scopeIds: [movedScopeId],
    });

    await expect(
      operations.upsertNode('event:42', { name: 'Planning', metadata: { agenda: 'Imported' } }),
    ).rejects.toThrow('changed outside importer calendar');
    expect(await operations.removeNode('event:42')).toEqual({ node: moved, deleted: false });
    expect(await (await knowledge.getStorageInternal()).getNodeAddress({ source, address: 'event:42' })).toMatchObject({
      nodeId: handle.id,
    });
  });

  it('enforces append authority and active binding runs', async () => {
    const { knowledge, operations, run } = await createFixture('append');
    const node = await operations.upsertNode('event:42', { name: 'Planning' });
    const record = await node.appendRecord({ text: 'Imported details' });

    await expect(node.removeRecord(record.id)).rejects.toThrow('owner authority');
    await knowledge.updateImportRun({ id: run.id, status: 'succeeded' });
    await expect(operations.getNode('event:42')).rejects.toThrow('is not active');
    await expect(operations.listNodes()).rejects.toThrow('is not active');
    await expect(node.listRecords()).rejects.toThrow('is not active');
    await expect(operations.upsertNode('event:44', { name: 'Closed run' })).rejects.toThrow('is not active');

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
});
