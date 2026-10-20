import { describe, expect, it } from 'vitest';
import { InMemoryStore, knowledgeImporterBindingKey, knowledgeImportStoredRecordId } from '../../../storage';
import { Knowledge } from '../../index';
import { createStaticKnowledgeImporterOperations } from '../static-importer';

const importerId = 'calendar';
const source = 'google-calendar:primary';
const scopeAddress = 'project:mastra';
const binding = knowledgeImporterBindingKey({ source, scope: scopeAddress });

function calendar(storage: InMemoryStore, handler: () => Promise<void> = async () => {}) {
  return new Knowledge({
    id: 'calendar-knowledge',
    storage,
    structure: {
      scopes: [
        { address: 'org:acme', name: 'Acme' },
        { address: scopeAddress, name: 'Mastra', parentAddresses: ['org:acme'] },
      ],
    },
    importers: [{ id: importerId, access: { 'project:$projectId': 'edit' }, handler }],
  });
}

async function beginRun(knowledge: Knowledge, id: string) {
  const queued = await knowledge.createImportRun({
    id,
    importerId,
    binding,
    importKind: 'static',
    triggerKind: 'programmatic',
  });
  return knowledge.updateImportRun({ id: queued.id, status: 'running' });
}

describe('Knowledge importer snapshot upgrades', () => {
  it('preserves durable history and converges stable static calendar identities across reconstruction', async () => {
    const storage = new InMemoryStore({ id: 'snapshot-upgrade' });
    const initial = calendar(storage);
    const projectScopeId = (await initial.reconcile()).scopes[scopeAddress]!;
    const firstRun = await beginRun(initial, 'calendar-run-v1');
    const firstOperations = await createStaticKnowledgeImporterOperations({
      knowledge: initial,
      importerId,
      source,
      scopeAddress,
      importRunId: firstRun.id,
    });
    const firstNode = await firstOperations.upsertNode('event:architecture-review', {
      scopes: [firstOperations.scope],
      name: 'Architecture review',
      metadata: { revision: 1 },
    });
    const firstRecord = await firstNode.appendKnowledge({
      id: 'calendar-record-architecture-review',
      text: '10:00–11:00',
    });
    await initial.setImportState({ importerId, binding, key: 'cursor', value: '2026-10-12T11:00:00.000Z' });
    await initial.updateImportRun({ id: firstRun.id, status: 'succeeded' });

    const reconstructed = calendar(storage);
    await expect(reconstructed.getImportRun(firstRun.id)).resolves.toMatchObject({
      id: firstRun.id,
      status: 'succeeded',
    });
    await expect(reconstructed.getImportState({ importerId, binding, key: 'cursor' })).resolves.toMatchObject({
      value: '2026-10-12T11:00:00.000Z',
    });

    const beforeReplayNodes = await reconstructed.listNodes({ scopeIds: [projectScopeId] });
    const beforeReplayRecords = (
      await reconstructed.listRecords({ node: firstNode.id, scopeIds: [projectScopeId], limit: 100 })
    ).records;
    const replayRun = await beginRun(reconstructed, 'calendar-run-v2');
    const replayOperations = await createStaticKnowledgeImporterOperations({
      knowledge: reconstructed,
      importerId,
      source,
      scopeAddress,
      importRunId: replayRun.id,
    });
    const replayedNode = await replayOperations.upsertNode('event:architecture-review', {
      scopes: [replayOperations.scope],
      name: 'Architecture review',
      metadata: { revision: 2 },
    });
    const replayedRecord = await replayedNode.appendKnowledge({
      id: 'calendar-record-architecture-review',
      text: '10:00–11:00',
    });
    await reconstructed.setImportState({ importerId, binding, key: 'cursor', value: '2026-10-12T12:00:00.000Z' });
    await reconstructed.updateImportRun({ id: replayRun.id, status: 'succeeded' });

    expect(replayRun.id).not.toBe(firstRun.id);
    expect(replayedNode.id).toBe(firstNode.id);
    expect(replayedRecord.id).toBe(firstRecord.id);
    expect((await reconstructed.listNodes({ scopeIds: [projectScopeId] })).map(node => node.id).sort()).toEqual(
      beforeReplayNodes.map(node => node.id).sort(),
    );
    expect(
      (await reconstructed.listRecords({ node: firstNode.id, scopeIds: [projectScopeId], limit: 100 })).records
        .map(record => record.id)
        .sort(),
    ).toEqual(beforeReplayRecords.map(record => record.id).sort());
    expect(await reconstructed.listActivity({ scopeIds: [projectScopeId], importRunId: replayRun.id })).toContainEqual(
      expect.objectContaining({ action: 'edit', targetId: firstNode.id, importRunId: replayRun.id }),
    );

    const secondReconstruction = calendar(storage);
    await expect(secondReconstruction.getImportRun(replayRun.id)).resolves.toMatchObject({
      id: replayRun.id,
      status: 'succeeded',
    });
    await expect(secondReconstruction.getImportState({ importerId, binding, key: 'cursor' })).resolves.toMatchObject({
      value: '2026-10-12T12:00:00.000Z',
    });
    await expect(secondReconstruction.getNode(firstNode.id)).resolves.toMatchObject({
      id: firstNode.id,
      metadata: { revision: 2 },
    });
    // The importer names its record; storage holds it under the binding-qualified id.
    const storedRecordId = knowledgeImportStoredRecordId({ importerId, binding }, firstRecord.id);
    await expect(secondReconstruction.getRecord({ id: storedRecordId })).resolves.toMatchObject({
      id: storedRecordId,
      text: '10:00–11:00',
    });

    const removedImporter = new Knowledge({ id: 'calendar-knowledge', storage });
    await expect(removedImporter.getImportRun(firstRun.id)).resolves.toMatchObject({ id: firstRun.id });
    await expect(removedImporter.listImportRuns({ importerId })).resolves.toMatchObject({
      runs: [expect.objectContaining({ id: replayRun.id }), expect.objectContaining({ id: firstRun.id })],
    });
    await expect(
      removedImporter.listActivity({ scopeIds: [projectScopeId], importRunId: replayRun.id }),
    ).resolves.toContainEqual(expect.objectContaining({ targetId: firstNode.id, importRunId: replayRun.id }));
    await expect(removedImporter.listImportRuns()).resolves.toEqual({ runs: [], nextCursor: undefined });
    expect(() => removedImporter.runImporter(importerId, { source, scope: scopeAddress })).toThrow('not registered');
    await expect(removedImporter.getImportState({ importerId, binding, key: 'cursor' })).rejects.toThrow(
      'not registered',
    );
    await expect(
      removedImporter.setImportState({ importerId, binding, key: 'cursor', value: 'forbidden' }),
    ).rejects.toThrow('not registered');
    await expect(
      removedImporter.createImportRun({ importerId, binding, importKind: 'static', triggerKind: 'programmatic' }),
    ).rejects.toThrow('not registered');
    await expect(removedImporter.updateImportRun({ id: replayRun.id, status: 'failed' })).rejects.toThrow(
      'not registered',
    );
  });
});
