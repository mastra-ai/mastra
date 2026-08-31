import { describe, expect, it } from 'vitest';

import { Knowledge } from '..';
import { InMemoryStore } from '../../storage';

async function createFixture() {
  const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'mutation-authorization' }) });
  const storage = await knowledge.getStorageInternal();
  const structure = await storage.reconcileStructure({
    scopes: [
      { address: 'principal:readonly', name: 'Readonly principal' },
      { address: 'principal:append', name: 'Append principal' },
      { address: 'principal:edit', name: 'Edit principal' },
      { address: 'principal:owner', name: 'Owner principal' },
      {
        address: 'scope:readonly',
        name: 'Readonly scope',
        grants: [{ scopeRefAddress: 'principal:readonly', role: 'readonly' }],
      },
      {
        address: 'scope:append',
        name: 'Append scope',
        grants: [{ scopeRefAddress: 'principal:append', role: 'append' }],
      },
      {
        address: 'scope:edit',
        name: 'Edit scope',
        grants: [{ scopeRefAddress: 'principal:edit', role: 'edit' }],
      },
      {
        address: 'scope:owner',
        name: 'Owner scope',
        grants: [{ scopeRefAddress: 'principal:owner', role: 'owner' }],
      },
      {
        address: 'scope:mixed',
        name: 'Mixed scope',
        grants: [
          { scopeRefAddress: 'principal:append', role: 'readonly' },
          { scopeRefAddress: 'principal:owner', role: 'owner' },
        ],
      },
    ],
  });
  return { knowledge, storage, ids: structure.scopes };
}

describe('Knowledge mutation authorization', () => {
  it('enforces readonly, append, edit, and owner capability boundaries', async () => {
    const { knowledge, storage, ids } = await createFixture();

    await expect(
      knowledge.createNode({
        name: 'Denied',
        scopeIds: [ids['scope:readonly']!],
        vouchedScopeIds: [ids['principal:readonly']!],
      }),
    ).rejects.toThrow(`Knowledge scope not found: ${ids['scope:readonly']}`);

    const appended = await knowledge.createNode({
      name: 'Appended',
      scopeIds: [ids['scope:append']!],
      vouchedScopeIds: [ids['principal:append']!],
    });
    await expect(
      knowledge.updateNode({
        id: appended.id,
        version: appended.version,
        name: 'Denied edit',
        vouchedScopeIds: [ids['principal:append']!],
      }),
    ).rejects.toThrow(`Knowledge node not found: ${appended.id}`);

    const editable = await storage.createNode({ name: 'Editable', scopeIds: [ids['scope:edit']!] });
    const updated = await knowledge.updateNode({
      id: editable.id,
      version: editable.version,
      name: 'Edited',
      vouchedScopeIds: [ids['principal:edit']!],
    });
    expect(updated.name).toBe('Edited');

    const owned = await storage.createNode({ name: 'Owned', scopeIds: [ids['scope:owner']!] });
    const record = await storage.createRecord({ node: owned, text: 'Owned record', scopeIds: [ids['scope:owner']!] });
    await expect(
      knowledge.deleteRecord({
        id: record.id,
        version: record.version,
        deletedBy: 'owner',
        vouchedScopeIds: [ids['principal:edit']!],
      }),
    ).rejects.toThrow(`Knowledge record not found: ${record.id}`);
    const deleted = await knowledge.deleteRecord({
      id: record.id,
      version: record.version,
      deletedBy: 'owner',
      vouchedScopeIds: [ids['principal:owner']!],
    });
    expect(deleted).toMatchObject({ id: record.id, deletedBy: 'owner' });
    await expect(
      knowledge.restoreRecord({
        id: record.id,
        version: deleted.version,
        vouchedScopeIds: [ids['principal:edit']!],
      }),
    ).rejects.toThrow(`Knowledge record not found: ${record.id}`);
    await expect(
      knowledge.restoreRecord({
        id: record.id,
        version: deleted.version,
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).resolves.toMatchObject({ id: record.id, deletedAt: undefined, deletedBy: undefined });
  });

  it('fails multi-scope writes before mutation, activity, or semantic outbox effects', async () => {
    const { knowledge, storage, ids } = await createFixture();
    const node = await storage.createNode({ name: 'Append target', scopeIds: [ids['scope:append']!] });
    const beforeActivity = await storage.listActivity({
      scopeIds: [ids['scope:append']!, ids['scope:mixed']!],
      limit: 100,
    });
    const beforeOutbox = await storage.listSemanticOutbox({ limit: 100 });

    await expect(
      knowledge.createRecord({
        id: 'denied-multi-scope-record',
        node,
        text: 'Must not persist',
        scopeIds: [ids['scope:append']!, ids['scope:mixed']!],
        vouchedScopeIds: [ids['principal:append']!],
      }),
    ).rejects.toThrow(`Knowledge scope not found: ${ids['scope:mixed']}`);

    expect(await storage.getRecord({ id: 'denied-multi-scope-record', includeDeleted: true })).toBeNull();
    expect(await storage.listActivity({ scopeIds: [ids['scope:append']!, ids['scope:mixed']!], limit: 100 })).toEqual(
      beforeActivity,
    );
    expect(await storage.listSemanticOutbox({ limit: 100 })).toEqual(beforeOutbox);
  });

  it('enforces all-target authority for node moves and merges', async () => {
    const { knowledge, storage, ids } = await createFixture();
    const movable = await storage.createNode({ name: 'Movable', scopeIds: [ids['scope:owner']!] });

    await expect(
      knowledge.updateNode({
        id: movable.id,
        version: movable.version,
        scopeIds: [ids['scope:append']!],
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).rejects.toThrow(`Knowledge scope not found: ${ids['scope:append']}`);
    expect(await storage.getNodeScopeIds(movable.id)).toEqual([ids['scope:owner']]);

    const source = await storage.createNode({ name: 'Merge source', scopeIds: [ids['scope:owner']!] });
    const target = await storage.createNode({ name: 'Merge target', scopeIds: [ids['scope:edit']!] });
    await expect(
      knowledge.mergeNodes({
        sourceId: source.id,
        targetId: target.id,
        sourceVersion: source.version,
        vouchedScopeIds: [ids['principal:edit']!],
      }),
    ).rejects.toThrow(`Knowledge node not found: ${source.id}`);
    await expect(storage.getNode(source.id)).resolves.toMatchObject({ name: 'Merge source', version: source.version });

    await expect(
      knowledge.mergeNodes({
        sourceId: source.id,
        targetId: target.id,
        sourceVersion: source.version,
        vouchedScopeIds: [ids['principal:owner']!, ids['principal:edit']!],
      }),
    ).resolves.toMatchObject({ id: target.id });
  });

  it('requires record edit authority to remove scope stamps and destination append authority to add them', async () => {
    const { knowledge, storage, ids } = await createFixture();
    const node = await storage.createNode({ name: 'Rescope owner', scopeIds: [ids['scope:owner']!] });
    const record = await storage.createRecord({ node, text: 'Rescope record', scopeIds: [ids['scope:owner']!] });

    await expect(
      knowledge.setRecordScopes({
        id: record.id,
        version: record.version,
        scopeIds: [ids['scope:append']!],
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).rejects.toThrow(`Knowledge scope not found: ${ids['scope:append']}`);
    expect(await storage.getRecordScopeIds(record.id)).toEqual([ids['scope:owner']]);

    await expect(
      knowledge.setRecordScopes({
        id: record.id,
        version: record.version,
        scopeIds: [ids['scope:append']!],
        vouchedScopeIds: [ids['principal:owner']!, ids['principal:append']!],
      }),
    ).resolves.toMatchObject({ id: record.id, version: record.version + 1 });
    expect(await storage.getRecordScopeIds(record.id)).toEqual([ids['scope:append']]);
  });

  it('allows an editor to remove a stamp without granting append to a new destination', async () => {
    const { knowledge, storage, ids } = await createFixture();
    const node = await storage.createNode({ name: 'Editor rescope', scopeIds: [ids['scope:edit']!] });
    const record = await storage.createRecord({
      node,
      text: 'Editor rescope record',
      scopeIds: [ids['scope:edit']!, ids['scope:append']!],
    });

    const removed = await knowledge.setRecordScopes({
      id: record.id,
      version: record.version,
      scopeIds: [ids['scope:edit']!],
      vouchedScopeIds: [ids['principal:edit']!],
    });
    expect(await storage.getRecordScopeIds(record.id)).toEqual([ids['scope:edit']]);

    await expect(
      knowledge.setRecordScopes({
        id: record.id,
        version: removed.version,
        scopeIds: [ids['scope:edit']!, ids['scope:owner']!],
        vouchedScopeIds: [ids['principal:edit']!],
      }),
    ).rejects.toThrow(`Knowledge scope not found: ${ids['scope:owner']}`);
  });

  it('requires owner authority on every containing scope for promotion and rejects non-empty demotion', async () => {
    const { knowledge, storage, ids } = await createFixture();
    const promotable = await storage.createNode({
      name: 'Promotable',
      scopeIds: [ids['scope:owner']!, ids['scope:edit']!],
    });

    await expect(
      knowledge.updateNode({
        id: promotable.id,
        version: promotable.version,
        isScope: true,
        vouchedScopeIds: [ids['principal:owner']!, ids['principal:edit']!],
      }),
    ).rejects.toThrow(`Knowledge scope not found: ${ids['scope:edit']}`);

    const scope = await storage.createNode({ name: 'Demotion target', isScope: true, scopeIds: [ids['scope:owner']!] });
    await storage.createNode({ name: 'Demotion member', scopeIds: [scope.id] });
    await expect(
      knowledge.updateNode({
        id: scope.id,
        version: scope.version,
        isScope: false,
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).rejects.toThrow('Knowledge scope has dependents');
  });

  it('rejects empty memberships on public creates and moves', async () => {
    const { knowledge, storage, ids } = await createFixture();
    await expect(
      knowledge.createNode({ name: 'Parentless', scopeIds: [], vouchedScopeIds: [ids['principal:owner']!] }),
    ).rejects.toThrow('Knowledge scope not found');

    const node = await storage.createNode({ name: 'Root move', scopeIds: [ids['scope:owner']!] });
    await expect(
      knowledge.createRecord({
        node,
        text: 'Unstamped',
        scopeIds: [],
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).rejects.toThrow('Knowledge scope not found');

    const record = await storage.createRecord({ node, text: 'Stamped', scopeIds: [ids['scope:owner']!] });
    await expect(
      knowledge.setRecordScopes({
        id: record.id,
        version: record.version,
        scopeIds: [],
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).rejects.toThrow('Knowledge scope not found');

    await expect(
      knowledge.updateNode({
        id: node.id,
        version: node.version,
        scopeIds: [],
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).rejects.toThrow('Knowledge scope not found');
    expect(await storage.getNodeScopeIds(node.id)).toEqual([ids['scope:owner']]);
  });

  it('preserves numeric CAS after authorization succeeds', async () => {
    const { knowledge, storage, ids } = await createFixture();
    const node = await storage.createNode({ name: 'CAS target', scopeIds: [ids['scope:edit']!] });

    await expect(
      knowledge.updateNode({
        id: node.id,
        version: node.version + 1,
        name: 'Stale update',
        vouchedScopeIds: [ids['principal:edit']!],
      }),
    ).rejects.toThrow('version conflict');
    await expect(storage.getNode(node.id)).resolves.toMatchObject({ name: 'CAS target', version: node.version });
  });
});
