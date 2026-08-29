import { describe, expect, it } from 'vitest';
import { InMemoryStore, knowledgeImporterBindingKey } from '../../../storage';
import { Knowledge } from '../../index';

const scopeIds = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'];
const binding = knowledgeImporterBindingKey({ source: 'google-calendar:primary', scope: 'project:mastra' });

async function createFixture(role: 'append' | 'edit' | 'owner' = 'edit') {
  const knowledge = new Knowledge({
    storage: new InMemoryStore({ id: `static-import-${role}` }),
    importers: [
      {
        id: 'calendar',
        access: { 'project:$projectId': role },
        handler: async () => {},
      },
    ],
  });
  const storage = await knowledge.getStorage();
  await storage.createNode({ id: scopeIds[0], name: 'Acme', isScope: true, scopeIds: [] });
  await storage.createNode({ id: scopeIds[1], name: 'Mastra', isScope: true, scopeIds: [scopeIds[0]!] });
  const queuedRun = await knowledge.createImportRun({
    importerId: 'calendar',
    binding,
    importKind: 'static',
    triggerKind: 'programmatic',
  });
  const run = await knowledge.updateImportRun({ id: queuedRun.id, status: 'running' });
  const operations = await knowledge.createStaticImporterOperations({
    importerId: 'calendar',
    binding,
    importRunId: run.id,
    source: { type: 'google-calendar', id: 'primary' },
    scopeIds,
    role,
  });
  return { knowledge, operations, run };
}

describe('static Knowledge importer operations', () => {
  it('upserts deterministic external addresses idempotently', async () => {
    const { knowledge, operations, run } = await createFixture();
    const first = await operations.upsertNode({
      address: 'event:42',
      name: 'Architecture review',
      kind: 'event',
      metadata: { agenda: 'Initial' },
    });
    const replayed = await operations.upsertNode({
      address: 'event:42',
      name: 'Architecture review',
      kind: 'event',
      metadata: { agenda: 'Initial' },
    });
    const updated = await operations.upsertNode({
      address: 'event:42',
      name: 'Architecture review',
      kind: 'event',
      metadata: { agenda: 'Updated' },
    });

    expect(replayed.node).toEqual(first.node);
    expect(updated.node).toMatchObject({ id: first.id, version: 2, metadata: { agenda: 'Updated' } });
    expect((await operations.getNode('event:42'))?.node).toEqual(updated.node);
    expect((await operations.listNodes()).map(handle => handle.node)).toEqual([updated.node]);
    expect(await knowledge.listActivity({ scopeIds, importRunId: run.id })).toEqual([
      expect.objectContaining({ action: 'edit', targetId: first.id, importRunId: run.id }),
      expect.objectContaining({ action: 'create', targetId: first.id, importRunId: run.id }),
    ]);
  });

  it('creates ordinary records with source provenance and ownership-bounded removal', async () => {
    const { knowledge, operations, run } = await createFixture();
    const node = await operations.upsertNode({ address: 'event:42', name: 'Planning', kind: 'event' });
    const imported = await node.createRecord({ id: 'record-imported', text: '10:00–11:00', metadata: { room: 'A' } });
    const foreign = await knowledge.createRecord({
      id: 'record-curated',
      node: node.id,
      text: 'Curator note',
      scopeIds,
      source: 'curator',
      importRunId: run.id,
    });

    expect(await node.listRecords()).toEqual([
      expect.objectContaining({ id: imported.id, source: '["google-calendar","primary"]' }),
    ]);
    await expect(node.removeRecord(foreign.id)).rejects.toThrow('owned by another source');
    expect(await node.removeRecord(imported.id)).toEqual(imported);
    expect(await node.removeRecord(imported.id)).toBeNull();
    expect(await knowledge.getRecord({ id: imported.id, includeDeleted: true })).toBeNull();
    expect(await knowledge.getRecord({ id: foreign.id })).toEqual(foreign);
  });

  it('preserves UUID identity while explicitly rebinding addresses', async () => {
    const { operations } = await createFixture('owner');
    const node = await operations.upsertNode({ address: 'event:old', name: 'Planning', kind: 'event' });

    const rebound = await operations.rebindNode({ address: 'event:old', newAddress: 'event:new' });

    expect(rebound.id).toBe(node.id);
    expect((await operations.rebindNode({ address: 'event:old', newAddress: 'event:new' })).id).toBe(node.id);
    expect((await operations.rebindNode({ address: 'event:new', newAddress: 'event:new' })).id).toBe(node.id);
    expect((await operations.getNode('event:new'))?.id).toBe(node.id);
    expect(await operations.getNode('event:old')).toBeNull();
    await operations.unbindNode('event:new');
    expect(await operations.getNode('event:new')).toBeNull();
  });

  it('physically deletes only after the final external binding is removed', async () => {
    const { knowledge, operations } = await createFixture('owner');
    const handle = await operations.upsertNode({ address: 'event:42', name: 'Planning', kind: 'event' });
    const storage = await knowledge.getStorage();
    await storage.setNodeAddress({ source: 'another-source', address: 'item:7', nodeId: handle.id });

    expect(await operations.removeNode('event:42')).toEqual({ node: handle.node, deleted: false });
    expect(await knowledge.getNode(handle.id)).toEqual(handle.node);
    await storage.removeNodeAddress({ source: 'another-source', address: 'item:7', nodeId: handle.id });
    await storage.setNodeAddress({ source: '["google-calendar","primary"]', address: 'event:42', nodeId: handle.id });
    expect(await operations.removeNode('event:42')).toEqual({ node: handle.node, deleted: true });
    expect(await operations.removeNode('event:42')).toBeNull();
    expect(await knowledge.getNode(handle.id)).toBeNull();
  });

  it('refuses to overwrite nodes changed outside the importer', async () => {
    const { knowledge, operations } = await createFixture('owner');
    const handle = await operations.upsertNode({
      address: 'event:42',
      name: 'Planning',
      kind: 'event',
      metadata: { agenda: 'Imported' },
    });
    await (
      await knowledge.getStorage()
    ).createNode({
      id: '10000000-0000-4000-8000-000000000004',
      name: 'Curated thread',
      isScope: true,
      scopeIds: [scopeIds[1]!],
    });
    await knowledge.updateNode({
      id: handle.id,
      version: handle.node.version,
      scopeIds: [...scopeIds, '10000000-0000-4000-8000-000000000004'],
    });

    await expect(
      operations.upsertNode({
        address: 'event:42',
        name: 'Planning',
        kind: 'event',
        metadata: { agenda: 'Imported' },
      }),
    ).rejects.toThrow('changed outside importer calendar');
    expect(await (await knowledge.getStorage()).getNodeScopeIds(handle.id)).toEqual([
      ...scopeIds,
      '10000000-0000-4000-8000-000000000004',
    ]);
  });

  it('removes importer records but preserves nodes with foreign records', async () => {
    const { knowledge, operations } = await createFixture('owner');
    const handle = await operations.upsertNode({ address: 'event:42', name: 'Planning', kind: 'event' });
    const imported = await handle.createRecord({ text: 'Imported details' });
    const foreign = await knowledge.createRecord({
      node: handle.id,
      text: 'Curated details',
      scopeIds,
      source: 'curator',
    });

    const result = await operations.removeNode('event:42');
    expect(result).toMatchObject({ node: { id: handle.id }, deleted: false });
    expect(await knowledge.getRecord({ id: imported.id, includeDeleted: true })).toBeNull();
    expect(await knowledge.getRecord({ id: foreign.id })).toEqual(foreign);
    expect(await knowledge.getNode(handle.id)).not.toBeNull();
  });

  it('enforces append authority and active importer runs', async () => {
    const { knowledge, operations, run } = await createFixture('append');
    const node = await operations.upsertNode({ address: 'event:42', name: 'Planning', kind: 'event' });
    const record = await node.createRecord({ text: 'Imported details' });

    await expect(node.removeRecord(record.id)).rejects.toThrow('append authority');
    await expect(operations.rebindNode({ address: 'event:42', newAddress: 'event:43' })).rejects.toThrow(
      'append authority',
    );
    await knowledge.updateImportRun({ id: run.id, status: 'succeeded' });
    await expect(operations.upsertNode({ address: 'event:44', name: 'Closed run', kind: 'event' })).rejects.toThrow(
      'is not active',
    );
  });

  it('rejects import runs from another binding', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'static-binding-mismatch' }),
      importers: [
        {
          id: 'calendar',
          access: { 'project:$projectId': 'owner' },
          handler: async () => {},
        },
      ],
    });
    const queued = await knowledge.createImportRun({
      importerId: 'calendar',
      binding: knowledgeImporterBindingKey({ source: 'google-calendar:primary', scope: 'project:other' }),
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    const run = await knowledge.updateImportRun({ id: queued.id, status: 'running' });

    await expect(
      knowledge.createStaticImporterOperations({
        importerId: 'calendar',
        binding,
        importRunId: run.id,
        source: { type: 'google-calendar', id: 'primary' },
        scopeIds,
        role: 'owner',
      }),
    ).rejects.toThrow('does not belong to calendar/');
  });
});
