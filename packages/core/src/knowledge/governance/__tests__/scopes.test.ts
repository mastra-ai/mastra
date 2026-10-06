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

  it('restores and idempotently re-creates scopes against a large unrelated hidden grant backlog', async () => {
    const { knowledge, rootId } = await createFixture();
    // A backlog of deleted scopes with retained grants — point restore and
    // creation-retry reads must not depend on this volume.
    for (let index = 0; index < 250; index += 1) {
      const backlog = await knowledge.createScope({
        address: `scope:backlog-${index}`,
        name: `Backlog ${index}`,
        parentAddresses: ['scope:root'],
        contextualScopeAddress: 'scope:root',
        vouchedScopeIds: [rootId],
      });
      const backlogId = backlog.scopes[`scope:backlog-${index}`]!;
      await knowledge.deleteNode({ id: backlogId, version: 1, deletedBy: rootId, vouchedScopeIds: [rootId] });
    }

    const target = await knowledge.createScope({
      address: 'scope:target',
      name: 'Target',
      parentAddresses: ['scope:root'],
      contextualScopeAddress: 'scope:root',
      vouchedScopeIds: [rootId],
    });
    const targetId = target.scopes['scope:target']!;
    const deletedTarget = await knowledge.deleteNode({
      id: targetId,
      version: 1,
      deletedBy: rootId,
      vouchedScopeIds: [rootId],
    });

    const restored = await knowledge.restoreNode({
      id: targetId,
      version: deletedTarget.version,
      vouchedScopeIds: [rootId],
    });
    expect(restored).toMatchObject({ id: targetId, deletedAt: undefined });

    // Idempotent re-creation of the live target exercises the
    // existing-creation comparison against the same backlog.
    const retried = await knowledge.createScope({
      address: 'scope:target',
      name: 'Target',
      parentAddresses: ['scope:root'],
      contextualScopeAddress: 'scope:root',
      vouchedScopeIds: [rootId],
    });
    expect(retried.scopes['scope:target']).toBe(targetId);
    expect(retried.changed).toBe(false);
  });

  async function childScope(knowledge: Knowledge, rootId: string, address: string) {
    const created = await knowledge.createScope({
      address,
      name: address,
      parentAddresses: ['scope:root'],
      contextualScopeAddress: 'scope:root',
      vouchedScopeIds: [rootId],
    });
    return created.scopes[address]!;
  }

  async function principal(knowledge: Knowledge, address: string) {
    const created = await knowledge.createRootScope({ address, name: address, contextualScopeAddress: address });
    return created.scopes[address]!;
  }

  // S2 — scope tombstone epoch invalidation.
  it('invalidates warmed frontiers when a granted scope is deleted and recomputes retained grants on restore', async () => {
    const { knowledge, storage, rootId } = await createFixture();
    const readerId = await principal(knowledge, 'principal:reader');
    const emptyId = await childScope(knowledge, rootId, 'scope:empty');
    const otherId = await childScope(knowledge, rootId, 'scope:other-live');
    for (const scopeId of [emptyId, otherId]) {
      await knowledge.shareScope({ scopeId, granteeScopeId: readerId, role: 'readonly', vouchedScopeIds: [rootId] });
    }

    const warmed = await knowledge.evaluateAccess([readerId]);
    expect(warmed.scopes[emptyId]?.read).toBe(true);
    expect(warmed.scopes[otherId]?.read).toBe(true);
    expect(await knowledge.evaluateAccess([readerId])).toBe(warmed);

    const beforeDelete = await storage.getAccessEpoch();
    const deleted = await knowledge.deleteNode({
      id: emptyId,
      version: 1,
      deletedBy: rootId,
      vouchedScopeIds: [rootId],
    });
    expect(await storage.getAccessEpoch()).toBe(beforeDelete + 1);
    expect(
      (await storage.listScopeGrants({ includeDeleted: true })).some(
        grant => grant.scopeNodeId === emptyId && grant.scopeRefId === readerId,
      ),
    ).toBe(true);

    const afterDelete = await knowledge.evaluateAccess([readerId]);
    expect(afterDelete).not.toBe(warmed);
    expect(afterDelete.accessEpoch).toBe(beforeDelete + 1);
    expect(afterDelete.scopes[emptyId]).toBeUndefined();
    expect(afterDelete.scopes[otherId]?.read).toBe(true);

    await expect(
      knowledge.restoreNode({ id: emptyId, version: deleted.version, vouchedScopeIds: [readerId] }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
    expect(await storage.getAccessEpoch()).toBe(beforeDelete + 1);

    await knowledge.restoreNode({ id: emptyId, version: deleted.version, vouchedScopeIds: [rootId] });
    expect(await storage.getAccessEpoch()).toBe(beforeDelete + 2);
    const afterRestore = await knowledge.evaluateAccess([readerId]);
    expect(afterRestore.accessEpoch).toBe(beforeDelete + 2);
    expect(afterRestore.scopes[emptyId]?.read).toBe(true);
    expect(afterRestore.scopes[otherId]?.read).toBe(true);
  });

  // S11 — private grants: suffixes, mirrors and extra memberships do not make content private.
  it('keeps mirrored provisional scopes public and isolates private scopes only through restricted grants', async () => {
    const { knowledge, rootId } = await createFixture();
    const orgId = await principal(knowledge, 'principal:org');
    const teamId = await principal(knowledge, 'principal:team');
    const maintainerId = await principal(knowledge, 'principal:maintainer');
    const publicId = await childScope(knowledge, rootId, 'feature:knowledge:public');
    const provisionalId = await childScope(knowledge, rootId, 'feature:knowledge:provisional');
    const privateId = await childScope(knowledge, rootId, 'feature:knowledge:internal');

    await knowledge.shareScope({
      scopeId: publicId,
      granteeScopeId: orgId,
      role: 'readonly',
      canSuggest: true,
      vouchedScopeIds: [rootId],
    });
    await knowledge.shareScope({
      scopeId: provisionalId,
      granteeScopeId: publicId,
      role: 'mirror',
      vouchedScopeIds: [rootId],
    });
    await knowledge.shareScope({ scopeId: privateId, granteeScopeId: teamId, role: 'edit', vouchedScopeIds: [rootId] });
    await knowledge.shareScope({
      scopeId: privateId,
      granteeScopeId: maintainerId,
      role: 'owner',
      vouchedScopeIds: [rootId],
    });

    const org = await knowledge.evaluateAccess([orgId]);
    expect(org.scopes[publicId]).toMatchObject({ read: true, suggest: true, edit: false });
    expect(org.scopes[provisionalId]).toEqual(org.scopes[publicId]);
    expect(org.scopes[privateId]).toBeUndefined();
    expect(org.scopes[teamId]).toBeUndefined();

    const team = await knowledge.evaluateAccess([orgId, teamId]);
    expect(team.scopes[privateId]).toMatchObject({ read: true, edit: true, manageAccess: false });
    const maintainer = await knowledge.evaluateAccess([maintainerId]);
    expect(maintainer.scopes[privateId]).toMatchObject({ read: true, manageAccess: true });
    expect(maintainer.scopes[publicId]).toBeUndefined();

    const dual = await knowledge.createNode({
      name: 'Dual membership',
      scopeIds: [publicId, privateId],
      vouchedScopeIds: [rootId],
    });
    const privateRecord = await knowledge.createRecord({
      node: dual,
      text: 'Private-only detail',
      scopeIds: [privateId],
      vouchedScopeIds: [rootId],
    });
    const copiedRecord = await knowledge.createRecord({
      node: dual,
      text: 'Private-only detail copied into public prose',
      scopeIds: [publicId],
      vouchedScopeIds: [rootId],
    });

    await expect(knowledge.getNode({ id: dual.id, scopeIds: [orgId] })).resolves.toMatchObject({ id: dual.id });
    const orgRecords = await knowledge.listRecords({ node: dual, scopeIds: [orgId] });
    expect(orgRecords.records.map(record => record.id)).toEqual([copiedRecord.id]);
    expect(orgRecords.records[0]!.text).toContain('Private-only detail');
    const teamRecords = await knowledge.listRecords({ node: dual, scopeIds: [orgId, teamId] });
    expect(teamRecords.records.map(record => record.id).sort()).toEqual([copiedRecord.id, privateRecord.id].sort());
  });
});
