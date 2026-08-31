import { describe, expect, it } from 'vitest';

import { Knowledge } from '../..';
import { InMemoryStore } from '../../../storage';
import { KnowledgeConflictError, KnowledgeNotFoundError } from '../../../storage/domains/knowledge';

async function createFixture() {
  const knowledge = new Knowledge({
    storage: new InMemoryStore({ id: 'scope-governance' }),
    scopes: {
      custom: { access: [{ principal: 'self', role: 'owner' }] },
    },
  });
  const root = await knowledge.createRootScope({
    address: 'scope:root',
    name: 'Root',
    contextualScopeAddress: 'scope:root',
  });
  const rootId = root.scopes['scope:root']!;
  return { knowledge, storage: await knowledge.getStorageInternal(), rootId };
}

describe('Knowledge scope governance', () => {
  it('snapshots scope templates so post-startup config mutations do not change creation behavior', async () => {
    const scopes = { custom: { access: [{ principal: 'self' as const, role: 'owner' as const }] } };
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'immutable-scope-config' }), scopes });
    scopes.custom.access[0]!.role = 'readonly' as 'owner';

    const root = await knowledge.createRootScope({
      address: 'scope:immutable',
      contextualScopeAddress: 'scope:immutable',
    });
    const rootId = root.scopes['scope:immutable']!;
    expect((await knowledge.evaluateAccess([rootId])).scopes[rootId]?.manageAccess).toBe(true);
  });

  it('creates child scopes only with owner authority on every parent', async () => {
    const { knowledge, storage, rootId } = await createFixture();
    const other = await knowledge.createRootScope({
      address: 'scope:other',
      name: 'Other',
      contextualScopeAddress: 'scope:other',
    });

    await expect(
      knowledge.createScope({
        address: 'scope:denied',
        name: 'Denied',
        parentAddresses: ['scope:root', 'scope:other'],
        contextualScopeAddress: 'scope:root',
        vouchedScopeIds: [rootId],
      }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
    expect(await storage.getScopeAddress('scope:denied')).toBeNull();

    const created = await knowledge.createScope({
      address: 'scope:child',
      name: 'Child',
      parentAddresses: ['scope:root'],
      contextualScopeAddress: 'scope:root',
      vouchedScopeIds: [rootId],
    });
    expect(created.scopes['scope:child']).toBeDefined();
    expect(await storage.getNodeScopeIds(created.scopes['scope:child']!)).toEqual([rootId]);
    await expect(
      knowledge.createScope({
        address: 'scope:child',
        name: 'Child',
        parentAddresses: ['scope:root'],
        contextualScopeAddress: 'scope:root',
        vouchedScopeIds: [rootId],
      }),
    ).resolves.toMatchObject({ changed: false, createdScopeIds: [] });
    await expect(
      knowledge.createScope({
        address: 'scope:child',
        name: 'Conflicting child',
        parentAddresses: ['scope:root'],
        contextualScopeAddress: 'scope:root',
        vouchedScopeIds: [rootId],
      }),
    ).rejects.toBeInstanceOf(KnowledgeConflictError);
    expect(other.scopes['scope:other']).toBeDefined();
  });

  it('shares and revokes access atomically through the access epoch', async () => {
    const { knowledge, storage, rootId } = await createFixture();
    const grantee = await knowledge.createRootScope({
      address: 'principal:reader',
      name: 'Reader',
      contextualScopeAddress: 'principal:reader',
    });
    const granteeId = grantee.scopes['principal:reader']!;
    const before = await storage.getAccessEpoch();

    const shared = await knowledge.shareScope({
      scopeId: rootId,
      granteeScopeId: granteeId,
      role: 'readonly',
      vouchedScopeIds: [rootId],
    });
    expect(shared).toEqual({ changed: true, accessEpoch: before + 1 });
    expect((await knowledge.evaluateAccess([granteeId])).scopes[rootId]?.read).toBe(true);

    await knowledge.revokeScopeAccess({
      scopeId: rootId,
      granteeScopeId: granteeId,
      vouchedScopeIds: [rootId],
    });
    expect((await knowledge.evaluateAccess([granteeId])).scopes[rootId]).toBeUndefined();
  });

  it('recoverably deletes nodes while retaining records, memberships, and restore authority', async () => {
    const { knowledge, storage, rootId } = await createFixture();
    const node = await knowledge.createNode({ name: 'Recoverable', scopeIds: [rootId], vouchedScopeIds: [rootId] });
    const record = await knowledge.createRecord({
      node: node.id,
      text: 'Retained record',
      scopeIds: [rootId],
      vouchedScopeIds: [rootId],
    });

    const deleted = await knowledge.deleteNode({
      id: node.id,
      version: node.version,
      deletedBy: rootId,
      vouchedScopeIds: [rootId],
    });
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(await knowledge.getNode({ id: node.id, scopeIds: [rootId] })).toBeNull();
    expect(await knowledge.getNodeByName({ name: node.name, scopeIds: [rootId] })).toBeNull();
    expect(await knowledge.resolveNode({ name: node.name, scopeIds: [rootId] })).toBeNull();
    expect(await knowledge.listNodes({ scopeIds: [rootId], namePrefix: node.name })).toEqual([]);
    await expect(
      knowledge.createNode({ name: node.name, scopeIds: [rootId], vouchedScopeIds: [rootId] }),
    ).rejects.toBeInstanceOf(KnowledgeConflictError);
    expect(await storage.getRecord({ id: record.id })).toMatchObject({ id: record.id, nodeId: node.id });
    expect(await storage.getNodeScopeIds(node.id)).toEqual([rootId]);

    const restored = await knowledge.restoreNode({
      id: node.id,
      version: deleted.version,
      vouchedScopeIds: [rootId],
    });
    expect(restored.deletedAt).toBeUndefined();
    expect(await knowledge.getRecord({ id: record.id, scopeIds: [rootId] })).toMatchObject({ id: record.id });
  });

  it('deletes only empty scopes and keeps deleted addresses inert until authorized restoration', async () => {
    const { knowledge, storage, rootId } = await createFixture();
    const childResult = await knowledge.createScope({
      address: 'scope:child',
      name: 'Child',
      parentAddresses: ['scope:root'],
      contextualScopeAddress: 'scope:root',
      vouchedScopeIds: [rootId],
    });
    const childId = childResult.scopes['scope:child']!;
    const member = await knowledge.createNode({ name: 'Member', scopeIds: [childId], vouchedScopeIds: [rootId] });

    await expect(
      knowledge.deleteNode({ id: childId, version: 1, deletedBy: rootId, vouchedScopeIds: [rootId] }),
    ).rejects.toBeInstanceOf(KnowledgeConflictError);
    const deletedMember = await knowledge.deleteNode({
      id: member.id,
      version: member.version,
      deletedBy: rootId,
      vouchedScopeIds: [rootId],
    });
    expect(deletedMember.deletedAt).toBeDefined();

    const deletedScope = await knowledge.deleteNode({
      id: childId,
      version: 1,
      deletedBy: rootId,
      vouchedScopeIds: [rootId],
    });
    expect(await storage.getScopeAddress('scope:child')).toBeNull();
    await expect(
      knowledge.materializeScope({
        address: 'scope:child',
        name: 'Child',
        parentAddresses: ['scope:root'],
        contextualScopeAddress: 'scope:root',
      }),
    ).rejects.toThrow('explicitly deleted');
    await expect(
      knowledge.createScope({
        address: 'scope:child',
        name: 'Child',
        parentAddresses: ['scope:root'],
        contextualScopeAddress: 'scope:root',
        vouchedScopeIds: [rootId],
      }),
    ).rejects.toBeInstanceOf(KnowledgeConflictError);

    await expect(
      knowledge.restoreNode({ id: deletedScope.id, version: deletedScope.version, vouchedScopeIds: [] }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
    await expect(
      knowledge.restoreNode({ id: deletedScope.id, version: deletedScope.version, vouchedScopeIds: [rootId] }),
    ).resolves.toMatchObject({ id: childId, deletedAt: undefined });
  });

  it('requires retained managing authority in addition to parent ownership for child-scope restoration', async () => {
    const { knowledge, storage, rootId } = await createFixture();
    const child = await knowledge.createScope({
      address: 'scope:unmanaged-child',
      parentAddresses: ['scope:root'],
      contextualScopeAddress: 'scope:root',
      vouchedScopeIds: [rootId],
    });
    const childId = child.scopes['scope:unmanaged-child']!;
    const grant = (await storage.listScopeGrants()).find(
      candidate => candidate.scopeNodeId === childId && candidate.scopeRefId === rootId,
    )!;
    const node = await storage.getNode(childId);
    const deleted = await knowledge.deleteNode({
      id: childId,
      version: node!.version,
      deletedBy: rootId,
      vouchedScopeIds: [rootId],
    });
    await storage.removeScopeGrant({
      scopeNodeId: grant.scopeNodeId,
      scopeRefId: grant.scopeRefId,
      expectedAccessEpoch: await storage.getAccessEpoch(),
    });

    await expect(
      knowledge.restoreNode({ id: childId, version: deleted.version, vouchedScopeIds: [rootId] }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
  });

  it('keeps parentless root restoration host-only', async () => {
    const { knowledge, rootId } = await createFixture();
    const root = await knowledge.getNodeInternal(rootId);
    const deleted = await knowledge.deleteNode({
      id: rootId,
      version: root!.version,
      deletedBy: rootId,
      vouchedScopeIds: [rootId],
    });

    await expect(
      knowledge.restoreNode({ id: rootId, version: deleted.version, vouchedScopeIds: [rootId] }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
    await expect(knowledge.restoreRootScope({ id: rootId, version: deleted.version })).resolves.toMatchObject({
      id: rootId,
      deletedAt: undefined,
    });
  });
});
