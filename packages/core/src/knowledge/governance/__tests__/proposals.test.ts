import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { Knowledge } from '../..';
import { InMemoryStore } from '../../../storage';
import { KnowledgeConflictError, KnowledgeNotFoundError } from '../../../storage/domains/knowledge';
import { KnowledgeProposalLifecycle } from '../proposals';

async function createFixture() {
  const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'proposal-governance' }) });
  const storage = await knowledge.getStorageInternal();
  const structure = await storage.reconcileStructure({
    scopes: [
      { address: 'principal:suggest', name: 'Suggest principal' },
      { address: 'principal:owner', name: 'Owner principal' },
      { address: 'principal:edit', name: 'Edit principal' },
      { address: 'principal:observer', name: 'Observer principal' },
      {
        address: 'scope:source',
        name: 'Source scope',
        grants: [
          { scopeRefAddress: 'principal:suggest', role: 'readonly', canSuggest: true },
          { scopeRefAddress: 'principal:owner', role: 'owner' },
          { scopeRefAddress: 'principal:edit', role: 'edit' },
          { scopeRefAddress: 'principal:observer', role: 'readonly' },
        ],
      },
      {
        address: 'scope:destination',
        name: 'Destination scope',
        grants: [
          { scopeRefAddress: 'principal:suggest', role: 'readonly', canSuggest: true },
          { scopeRefAddress: 'principal:owner', role: 'owner' },
        ],
      },
    ],
  });
  const lifecycle = new KnowledgeProposalLifecycle(storage, scopeIds => knowledge.evaluateAccess(scopeIds));
  const node = await storage.createNode({ name: 'Draft', scopeIds: [structure.scopes['scope:source']!] });
  return { knowledge, storage, lifecycle, node, ids: structure.scopes };
}

describe('Knowledge proposal lifecycle', () => {
  it('lets suggest-only principals submit immutable proposals without direct mutation authority', async () => {
    const { knowledge, node, ids } = await createFixture();

    await expect(
      knowledge.updateNode({
        id: node.id,
        version: node.version,
        name: 'Direct edit',
        vouchedScopeIds: [ids['principal:suggest']!],
      }),
    ).rejects.toThrow(`Knowledge node not found: ${node.id}`);

    const proposal = await knowledge.proposeNodeUpdate({
      mutation: { id: node.id, version: node.version, name: 'Reviewed edit' },
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
      reason: 'The title is stale',
    });

    expect(proposal).toMatchObject({
      targetId: node.id,
      expectedVersion: node.version,
      operation: 'update-node',
      status: 'pending',
      proposerContextScopeId: ids['principal:suggest'],
      reason: 'The title is stale',
    });
    expect(await knowledge.getNode({ id: node.id, scopeIds: [ids['principal:suggest']!] })).toMatchObject({
      name: 'Draft',
      version: node.version,
    });
    await expect(knowledge.listProposals({ vouchedScopeIds: [ids['principal:suggest']!] })).resolves.toEqual({
      proposals: [expect.objectContaining({ id: proposal.id, status: 'pending' })],
      nextCursor: undefined,
    });
  });

  it('does not disclose stale versions before proposal authorization', async () => {
    const { lifecycle, node, ids } = await createFixture();
    await expect(
      lifecycle.proposeNodeUpdate({
        mutation: { id: node.id, version: node.version + 10, name: 'Unauthorized stale edit' },
        proposerContextScopeId: ids['scope:destination']!,
        vouchedScopeIds: [ids['scope:destination']!],
      }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
  });

  it('approves through fresh owner authority and records proposal, mutation, and approval activity', async () => {
    const { knowledge, storage, lifecycle, node, ids } = await createFixture();
    const proposal = await lifecycle.proposeNodeUpdate({
      mutation: {
        id: node.id,
        version: node.version,
        name: 'Approved title',
        contextScopeId: ids['scope:destination']!,
      },
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });

    expect(proposal.payload).not.toHaveProperty('mutation.contextScopeId');

    const approved = await lifecycle.approve({
      id: proposal.id,
      reviewerContextScopeId: ids['principal:owner']!,
      vouchedScopeIds: [ids['principal:owner']!],
    });

    expect(approved).toMatchObject({ status: 'approved', reviewerContextScopeId: ids['principal:owner'] });
    expect(await knowledge.getNode({ id: node.id, scopeIds: [ids['principal:owner']!] })).toMatchObject({
      name: 'Approved title',
      version: node.version + 1,
    });
    const activity = await storage.listActivity({
      scopeIds: [ids['scope:source']!, ids['principal:suggest']!, ids['principal:owner']!],
      limit: 100,
    });
    expect(activity.map(event => event.action)).toEqual(expect.arrayContaining(['propose', 'edit', 'approve']));
    expect(activity.find(event => event.action === 'edit')).toMatchObject({
      contextScopeId: ids['principal:owner'],
    });
  });

  it('requires owner authority to approve scope promotion without changing memberships', async () => {
    const { storage, lifecycle, node, ids } = await createFixture();
    const proposal = await lifecycle.proposeNodeUpdate({
      mutation: { id: node.id, version: node.version, isScope: true },
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    const before = await storage.getNode(node.id);

    await expect(
      lifecycle.approve({
        id: proposal.id,
        reviewerContextScopeId: ids['principal:edit']!,
        vouchedScopeIds: [ids['principal:edit']!],
      }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
    expect(await storage.getNode(node.id)).toEqual(before);
    expect(await storage.getProposal(proposal.id)).toMatchObject({ status: 'pending' });
    expect(proposal.targets).toEqual([expect.objectContaining({ id: node.id, approvalCapability: 'manageAccess' })]);

    await expect(
      lifecycle.approve({
        id: proposal.id,
        reviewerContextScopeId: ids['principal:owner']!,
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).resolves.toMatchObject({ status: 'approved' });
    expect(await storage.getNode(node.id)).toMatchObject({ isScope: true, version: node.version + 1 });
    expect(await storage.getNodeScopeIds(node.id)).toEqual([ids['scope:source']]);
  });

  it('retains edit authority for an ordinary proposed node update', async () => {
    const { storage, lifecycle, node, ids } = await createFixture();
    const proposal = await lifecycle.proposeNodeUpdate({
      mutation: { id: node.id, version: node.version, name: 'Editor approved' },
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    await expect(
      lifecycle.approve({
        id: proposal.id,
        reviewerContextScopeId: ids['principal:edit']!,
        vouchedScopeIds: [ids['principal:edit']!],
      }),
    ).resolves.toMatchObject({ status: 'approved' });
    expect(await storage.getNode(node.id)).toMatchObject({ name: 'Editor approved', version: node.version + 1 });
  });

  it('conflicts stale proposals and requires a replacement proposal for re-review', async () => {
    const { knowledge, storage, lifecycle, node, ids } = await createFixture();
    const proposal = await lifecycle.proposeNodeUpdate({
      mutation: { id: node.id, version: node.version, name: 'Proposed title' },
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    await knowledge.updateNode({
      id: node.id,
      version: node.version,
      name: 'Concurrent title',
      vouchedScopeIds: [ids['principal:owner']!],
    });

    await expect(
      lifecycle.approve({
        id: proposal.id,
        reviewerContextScopeId: ids['principal:owner']!,
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).rejects.toBeInstanceOf(KnowledgeConflictError);
    expect(await storage.getProposal(proposal.id)).toMatchObject({ status: 'conflicted' });

    const replacement = await lifecycle.reReview({
      id: proposal.id,
      reviewerContextScopeId: ids['principal:owner']!,
      vouchedScopeIds: [ids['principal:owner']!, ids['principal:suggest']!],
    });
    expect(replacement).toMatchObject({ status: 'pending', targetId: node.id, expectedVersion: node.version + 1 });
    expect(replacement.id).not.toBe(proposal.id);
    expect(await storage.getProposal(proposal.id)).toMatchObject({ status: 'conflicted' });
    await expect(
      lifecycle.approve({
        id: replacement.id,
        reviewerContextScopeId: ids['principal:owner']!,
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).resolves.toMatchObject({ status: 'approved' });
    await expect(knowledge.getNode({ id: node.id, scopeIds: [ids['principal:owner']!] })).resolves.toMatchObject({
      name: 'Proposed title',
      version: node.version + 2,
    });
  });

  it('hides conflicted proposals from target-only readers on list and single-id surfaces', async () => {
    const { knowledge, lifecycle, node, ids } = await createFixture();
    const proposal = await lifecycle.proposeNodeUpdate({
      mutation: { id: node.id, version: node.version, name: 'Proposed title' },
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    await knowledge.updateNode({
      id: node.id,
      version: node.version,
      name: 'Concurrent title',
      vouchedScopeIds: [ids['principal:owner']!],
    });
    await expect(
      lifecycle.approve({
        id: proposal.id,
        reviewerContextScopeId: ids['principal:owner']!,
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).rejects.toBeInstanceOf(KnowledgeConflictError);

    // The observer reads the target scope but neither the proposer context
    // nor any write authority: both surfaces must fail indistinguishably —
    // and reReview must not clone the hidden payload.
    const observerVouch = [ids['principal:observer']!];
    await expect(knowledge.listProposals({ vouchedScopeIds: observerVouch })).resolves.toEqual({
      proposals: [],
      nextCursor: undefined,
    });
    await expect(
      lifecycle.reReview({
        id: proposal.id,
        reviewerContextScopeId: ids['principal:observer']!,
        vouchedScopeIds: observerVouch,
      }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
  });

  it('atomically conflicts a proposal when the target changes after approval preflight', async () => {
    const { storage, lifecycle, node, ids } = await createFixture();
    const proposal = await lifecycle.proposeNodeUpdate({
      mutation: { id: node.id, version: node.version, name: 'Raced title' },
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    const applyProposal = storage.applyProposal.bind(storage);
    vi.spyOn(storage, 'applyProposal').mockImplementationOnce(async input => {
      await storage.updateNode({ id: node.id, version: node.version, name: 'Concurrent title' });
      return applyProposal(input);
    });

    await expect(
      lifecycle.approve({
        id: proposal.id,
        reviewerContextScopeId: ids['principal:owner']!,
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).rejects.toBeInstanceOf(KnowledgeConflictError);
    await expect(storage.getProposal(proposal.id)).resolves.toMatchObject({ status: 'conflicted' });
    await expect(storage.getNode(node.id)).resolves.toMatchObject({ name: 'Concurrent title' });
  });

  it('keeps pending proposals durable through proposer and approver revocation without leaking attribution', async () => {
    const { storage, lifecycle, node, ids } = await createFixture();
    const proposal = await lifecycle.proposeNodeUpdate({
      mutation: { id: node.id, version: node.version, name: 'Durable review' },
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });

    // Revoke the proposer's grant through the governed API; reconcile only seeds grants
    // at scope creation, so the revocation is durable.
    await storage.removeScopeGrant({
      scopeNodeId: ids['scope:source']!,
      scopeRefId: ids['principal:suggest']!,
    });
    await expect(lifecycle.list({ vouchedScopeIds: [ids['principal:suggest']!] })).resolves.toMatchObject({
      proposals: [],
    });
    const ownerView = await lifecycle.list({ vouchedScopeIds: [ids['principal:owner']!] });
    expect(ownerView).toEqual({
      proposals: [expect.objectContaining({ id: proposal.id, status: 'pending' })],
      nextCursor: undefined,
    });
    expect(ownerView.proposals[0]).not.toHaveProperty('proposerContextScopeId');

    await storage.removeScopeGrant({
      scopeNodeId: ids['scope:source']!,
      scopeRefId: ids['principal:owner']!,
    });
    await storage.upsertScopeGrant({
      scopeNodeId: ids['scope:source']!,
      scopeRefId: ids['principal:suggest']!,
      role: 'readonly',
      canSuggest: true,
    });
    await expect(lifecycle.list({ vouchedScopeIds: [ids['principal:owner']!] })).resolves.toMatchObject({
      proposals: [],
    });
    await expect(lifecycle.list({ vouchedScopeIds: [ids['principal:suggest']!] })).resolves.toEqual({
      proposals: [
        expect.objectContaining({
          id: proposal.id,
          status: 'pending',
          proposerContextScopeId: ids['principal:suggest'],
        }),
      ],
      nextCursor: undefined,
    });
    expect(await storage.getProposal(proposal.id)).toMatchObject({ status: 'pending' });
  });

  it('requires suggest and approval authority on every scope in a move', async () => {
    const { storage, lifecycle, node, ids } = await createFixture();
    const proposal = await lifecycle.proposeNodeUpdate({
      mutation: {
        id: node.id,
        version: node.version,
        scopeIds: [ids['scope:destination']!],
      },
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });

    expect(proposal.targets.map(target => target.id)).toEqual([
      node.id,
      ...[ids['scope:destination']!, ids['scope:source']!].sort(),
    ]);
    await expect(
      lifecycle.approve({
        id: proposal.id,
        reviewerContextScopeId: ids['principal:owner']!,
        vouchedScopeIds: [ids['principal:owner']!],
      }),
    ).resolves.toMatchObject({ status: 'approved' });
    expect(await storage.getNodeScopeIds(node.id)).toEqual([ids['scope:destination']]);
  });

  it('applies every governed mutation family with per-target version checks', async () => {
    const { knowledge, storage, lifecycle, node, ids } = await createFixture();
    const proposerContextScopeId = ids['principal:suggest']!;
    const reviewerContextScopeId = ids['principal:owner']!;
    const proposeAndApprove = async (mutation: Parameters<typeof knowledge.propose>[0]['mutation']) => {
      const proposal = await knowledge.propose({
        mutation,
        proposerContextScopeId,
        vouchedScopeIds: [proposerContextScopeId],
      });
      return lifecycle.approve({
        id: proposal.id,
        reviewerContextScopeId,
        vouchedScopeIds: [reviewerContextScopeId],
      });
    };

    const createdId = randomUUID();
    await proposeAndApprove({
      kind: 'create-node',
      mutation: { id: createdId, name: 'Created by proposal', scopeIds: [ids['scope:source']!] },
    });
    expect(await storage.getNode(createdId)).toMatchObject({ name: 'Created by proposal' });

    const moved = await storage.getNode(createdId);
    await proposeAndApprove({
      kind: 'move-node',
      mutation: { id: createdId, version: moved!.version, scopeIds: [ids['scope:destination']!] },
    });
    expect(await storage.getNodeScopeIds(createdId)).toEqual([ids['scope:destination']]);

    const scopeId = randomUUID();
    await proposeAndApprove({
      kind: 'create-scope',
      address: 'scope:proposed-child',
      mutation: { id: scopeId, name: 'Proposed child', isScope: true, scopeIds: [ids['scope:source']!] },
    });
    expect(await storage.getScopeAddress('scope:proposed-child')).toMatchObject({ scopeNodeId: scopeId });

    await storage.upsertScopeGrant({
      scopeNodeId: scopeId,
      scopeRefId: proposerContextScopeId,
      role: 'readonly',
      canSuggest: true,
    });
    await storage.upsertScopeGrant({ scopeNodeId: scopeId, scopeRefId: reviewerContextScopeId, role: 'owner' });
    const liveScope = await storage.getNode(scopeId);
    await proposeAndApprove({
      kind: 'delete-scope',
      mutation: { id: scopeId, version: liveScope!.version, deletedBy: proposerContextScopeId },
    });
    const deletedScope = await storage.getNodeIncludingDeleted(scopeId);
    expect(deletedScope?.deletedAt).toBeDefined();
    await proposeAndApprove({ kind: 'restore-scope', mutation: { id: scopeId, version: deletedScope!.version } });
    expect((await storage.getNode(scopeId))?.deletedAt).toBeUndefined();

    const record = await storage.createRecord({
      node: node.id,
      text: 'Governed record',
      scopeIds: [ids['scope:source']!],
    });
    await proposeAndApprove({
      kind: 'add-record-scope',
      mutation: {
        id: record.id,
        version: record.version,
        scopeIds: [ids['scope:source']!, ids['scope:destination']!],
      },
    });
    const stamped = await storage.getRecord({ id: record.id });
    expect(await storage.getRecordScopeIds(record.id)).toEqual(
      [ids['scope:destination']!, ids['scope:source']!].sort(),
    );
    await proposeAndApprove({
      kind: 'remove-record-scope',
      mutation: { id: record.id, version: stamped!.version, scopeIds: [ids['scope:source']!] },
    });

    const removedStamp = await storage.getRecord({ id: record.id });
    const deletedRecord = await storage.deleteRecord({
      id: record.id,
      version: removedStamp!.version,
      deletedBy: reviewerContextScopeId,
    });
    await proposeAndApprove({
      kind: 'restore-record',
      mutation: { id: record.id, version: deletedRecord.version },
    });
    expect((await storage.getRecord({ id: record.id }))?.deletedAt).toBeUndefined();

    const deletable = await storage.getNode(createdId);
    await proposeAndApprove({
      kind: 'delete-node',
      mutation: { id: createdId, version: deletable!.version, deletedBy: proposerContextScopeId },
    });
    const deletedNode = await storage.getNodeIncludingDeleted(createdId);
    await proposeAndApprove({
      kind: 'restore-node',
      mutation: { id: createdId, version: deletedNode!.version },
    });

    const mergeSource = await storage.getNode(createdId);
    await proposeAndApprove({
      kind: 'merge-nodes',
      mutation: { sourceId: createdId, targetId: node.id, sourceVersion: mergeSource!.version },
    });
    expect(await storage.getNode(createdId)).toBeNull();
  });
});
