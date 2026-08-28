import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../../storage';
import { Knowledge } from '../../index';

const scope = ['org:acme', 'resource:mastra'];

async function createFixture(role: 'append' | 'edit' | 'owner' = 'edit') {
  const knowledge = new Knowledge({
    storage: new InMemoryStore({ id: `static-import-${role}` }),
    importers: [
      {
        id: 'calendar',
        source: { type: 'google-calendar', id: 'primary' },
        kind: 'static',
        scope,
        role,
      },
    ],
  });
  const queuedRun = await knowledge.createImportRun({
    importerId: 'calendar',
    binding: 'project:mastra',
    importKind: 'static',
    triggerKind: 'programmatic',
  });
  const run = await knowledge.updateImportRun({ id: queuedRun.id, status: 'running' });
  const operations = await knowledge.createStaticImporterOperations({
    importerId: 'calendar',
    binding: 'project:mastra',
    importRunId: run.id,
  });
  return { knowledge, operations, run };
}

describe('static Knowledge importer operations', () => {
  it('upserts deterministic external addresses idempotently and lists importer-owned nodes', async () => {
    const { knowledge, operations, run } = await createFixture();
    const first = await operations.upsertNode({
      address: 'event:42',
      name: 'Architecture review',
      kind: 'event',
      content: 'Initial agenda',
    });
    const replayed = await operations.upsertNode({
      address: 'event:42',
      name: 'Architecture review',
      kind: 'event',
      content: 'Initial agenda',
    });
    const updated = await operations.upsertNode({
      address: 'event:42',
      name: 'Architecture review',
      kind: 'event',
      content: 'Updated agenda',
    });

    expect(replayed.node).toEqual(first.node);
    expect(updated.node).toMatchObject({ id: first.id, version: 2, content: 'Updated agenda' });
    expect((await operations.getNode('event:42'))?.node).toEqual(updated.node);
    expect((await operations.listNodes()).map(handle => handle.node)).toEqual([updated.node]);
    expect(await knowledge.listActivity({ scope, importRunId: run.id })).toEqual([
      expect.objectContaining({ action: 'node-updated', recordId: first.id, importRunId: run.id }),
      expect.objectContaining({ action: 'node-created', recordId: first.id, importRunId: run.id }),
    ]);
  });

  it('reconciles ordinary records with source provenance and ownership-bounded permanent removal', async () => {
    const { knowledge, operations, run } = await createFixture();
    const node = await operations.upsertNode({ address: 'event:42', name: 'Planning', kind: 'event' });
    const imported = await node.appendKnowledge({ text: '10:00–11:00', metadata: { room: 'A' } });
    const foreign = await knowledge.appendKnowledge({
      node: node.id,
      text: 'Curator note',
      scope,
      source: 'curator',
      sourceThreadId: 'thread:1',
      resolutionScope: scope,
      defaultScope: scope,
      importRunId: run.id,
    });

    expect(await node.listKnowledge()).toEqual([
      expect.objectContaining({ id: imported.id, source: '["google-calendar","primary"]' }),
    ]);
    await expect(node.removeKnowledge(foreign.id)).rejects.toThrow('owned by another source');
    expect(await node.removeKnowledge(imported.id)).toEqual(imported);
    expect(await node.removeKnowledge(imported.id)).toBeNull();
    expect(await knowledge.getKnowledge({ id: imported.id, includeDeleted: true })).toBeNull();
    expect(await knowledge.getKnowledge({ id: foreign.id })).toEqual(foreign);
  });

  it('preserves UUID identity while explicitly rebinding and leaves no stale address', async () => {
    const { operations } = await createFixture('owner');
    const node = await operations.upsertNode({ address: 'event:old', name: 'Planning', kind: 'event' });

    const rebound = await operations.rebindNode({ address: 'event:old', newAddress: 'event:new' });

    expect(rebound.id).toBe(node.id);
    expect((await operations.rebindNode({ address: 'event:old', newAddress: 'event:new' })).id).toBe(node.id);
    expect((await operations.rebindNode({ address: 'event:new', newAddress: 'event:new' })).id).toBe(node.id);
    expect((await operations.getNode('event:new'))?.id).toBe(node.id);
    expect(await operations.getNode('event:old')).toBeNull();
    expect((await operations.getNode('event:new'))?.node).toEqual(node.node);
    await operations.unbindNode('event:new');
    expect(await operations.getNode('event:new')).toBeNull();
  });

  it('permanently deletes only after the last external binding is explicitly removed', async () => {
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

  it('refuses to overwrite a node changed outside the importer', async () => {
    const { knowledge, operations } = await createFixture('owner');
    const handle = await operations.upsertNode({
      address: 'event:42',
      name: 'Planning',
      kind: 'event',
      content: 'Imported content',
    });
    await knowledge.updateNode({
      id: handle.id,
      version: handle.node.version,
      scope: [...scope, 'thread:curated'],
    });

    await expect(
      operations.upsertNode({
        address: 'event:42',
        name: 'Planning',
        kind: 'event',
        content: 'Imported content',
      }),
    ).rejects.toThrow('changed outside importer calendar');
    expect((await knowledge.getNode(handle.id))?.scope).toEqual([...scope, 'thread:curated']);
  });

  it('removes importer-owned records but preserves a node with foreign records', async () => {
    const { knowledge, operations } = await createFixture('owner');
    const handle = await operations.upsertNode({ address: 'event:42', name: 'Planning', kind: 'event' });
    const imported = await handle.appendKnowledge({ text: 'Imported details' });
    const foreign = await knowledge.appendKnowledge({
      node: handle.id,
      text: 'Curated details',
      scope: ['org:acme', 'resource:calendar'],
      source: 'curator',
    });

    const result = await operations.removeNode('event:42');
    expect(result).toMatchObject({ node: { id: handle.id }, deleted: false });
    expect(await knowledge.getNode(handle.id)).toEqual(result?.node);
    expect(await knowledge.getKnowledge({ id: imported.id, includeDeleted: true })).toBeNull();
    expect(await knowledge.getKnowledge({ id: foreign.id })).toEqual(foreign);
  });

  it('enforces run ownership and registered mutation authority', async () => {
    const { knowledge, operations, run } = await createFixture('append');
    const node = await operations.upsertNode({ address: 'event:42', name: 'Initial', kind: 'event' });
    const record = await node.appendKnowledge({ text: 'Initial record' });

    await expect(operations.upsertNode({ address: 'event:42', name: 'Changed', kind: 'event' })).rejects.toThrow(
      'cannot update existing nodes with append authority',
    );
    await expect(operations.rebindNode({ address: 'event:42', newAddress: 'event:43' })).rejects.toThrow(
      'cannot rebind nodes with append authority',
    );
    await expect(node.removeKnowledge(record.id)).rejects.toThrow('cannot remove records with append authority');
    await expect(operations.unbindNode('event:42')).rejects.toThrow('requires owner authority');
    await expect(
      knowledge.createStaticImporterOperations({
        importerId: 'calendar',
        binding: 'another-project',
        importRunId: run.id,
      }),
    ).rejects.toThrow(`does not belong to calendar/another-project`);

    await knowledge.updateImportRun({ id: run.id, status: 'succeeded' });
    await expect(node.appendKnowledge({ text: 'Late write' })).rejects.toThrow(`run ${run.id} is not active`);
    await expect(
      knowledge.createStaticImporterOperations({
        importerId: 'calendar',
        binding: 'project:mastra',
        importRunId: run.id,
      }),
    ).rejects.toThrow(`run ${run.id} is not active`);
  });
});
