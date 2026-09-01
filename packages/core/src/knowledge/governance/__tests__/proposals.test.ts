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
      {
        address: 'scope:source',
        name: 'Source scope',
        grants: [
          { scopeRefAddress: 'principal:suggest', role: 'readonly', canSuggest: true },
          { scopeRefAddress: 'principal:owner', role: 'owner' },
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
      vouchedScopeIds: [ids['principal:owner']!],
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

    await storage.reconcileStructure({
      scopes: [
        {
          address: 'scope:source',
          name: 'Source scope',
          grants: [{ scopeRefAddress: 'principal:owner', role: 'owner' }],
        },
      ],
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

    await storage.reconcileStructure({
      scopes: [
        {
          address: 'scope:source',
          name: 'Source scope',
          grants: [{ scopeRefAddress: 'principal:suggest', role: 'readonly', canSuggest: true }],
        },
      ],
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
});
