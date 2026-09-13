import { describe, expect, it, vi } from 'vitest';

import { Knowledge } from '../..';
import { InMemoryStore } from '../../../storage';
import type { KnowledgeProposalMutation } from '../../../storage/domains/knowledge';

async function createFixture() {
  const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'gap-governance' }) });
  const storage = await knowledge.getStorageInternal();
  const structure = await storage.reconcileStructure({
    scopes: [
      { address: 'principal:suggest', name: 'Suggest principal' },
      { address: 'principal:owner', name: 'Owner principal' },
      {
        address: 'scope:feature',
        name: 'Feature',
        grants: [
          { scopeRefAddress: 'principal:suggest', role: 'readonly', canSuggest: true },
          { scopeRefAddress: 'principal:owner', role: 'owner' },
        ],
      },
    ],
  });
  const ids = structure.scopes;
  const node = await storage.createNode({ name: 'Current claim', scopeIds: [ids['scope:feature']!] });
  const apply = async (mutation: KnowledgeProposalMutation) => {
    if (mutation.kind !== 'update-node') throw new Error(`Unexpected test mutation: ${mutation.kind}`);
    await knowledge.updateNode({
      ...mutation.mutation,
      vouchedScopeIds: [ids['principal:owner']!],
    });
  };
  return { knowledge, storage, ids, node, apply };
}

describe('Knowledge gap flags', () => {
  it('re-verifies one pending flag without passing proposer evidence and applies under worker authority', async () => {
    const { knowledge, storage, ids, node, apply } = await createFixture();
    const flag = await knowledge.fileGapFlag({
      claim: 'The title is stale',
      evidence: ['proposer supplied evidence must not be trusted'],
      targets: [{ type: 'node', id: node.id }],
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    const verify = vi.fn().mockResolvedValue({
      outcome: 'verified',
      evidence: ['fresh-source:revision-2'],
      mutation: {
        kind: 'update-node',
        mutation: { id: node.id, version: node.version, name: 'Verified title' },
      },
    });
    const worker = await knowledge.createGapQueueWorker({
      vouchedScopeIds: [ids['principal:owner']!],
      reviewerContextScopeId: ids['principal:owner']!,
      verify,
      apply,
    });

    await expect(Promise.all([worker.runOnce(), worker.runOnce()])).resolves.toEqual([
      expect.objectContaining({ id: flag.id, status: 'approved' }),
      expect.objectContaining({ id: flag.id, status: 'approved' }),
    ]);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0]![0]).toEqual({
      claim: 'The title is stale',
      targets: [{ type: 'node', id: node.id }],
      signal: expect.any(AbortSignal),
    });
    expect(await storage.getNode(node.id)).toMatchObject({ name: 'Verified title', version: node.version + 1 });
    expect(await storage.getProposal(flag.id)).toMatchObject({
      status: 'approved',
      reviewReason: expect.stringContaining('fresh-source:revision-2'),
    });
  });

  it('always escalates protected scopes and notifies without invoking the verifier', async () => {
    const { knowledge, ids, node, apply } = await createFixture();
    await knowledge.fileGapFlag({
      claim: 'Protected feature may be wrong',
      evidence: [],
      targets: [{ type: 'node', id: node.id }],
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    const verify = vi.fn();
    const notifyEscalation = vi.fn();
    const worker = await knowledge.createGapQueueWorker({
      vouchedScopeIds: [ids['principal:owner']!],
      reviewerContextScopeId: ids['principal:owner']!,
      protectedScopeIds: [ids['scope:feature']!],
      verify,
      apply,
      notifyEscalation,
    });

    await expect(worker.runOnce()).resolves.toMatchObject({ status: 'escalated' });
    expect(verify).not.toHaveBeenCalled();
    expect(notifyEscalation).toHaveBeenCalledWith(expect.objectContaining({ status: 'escalated' }));
    await expect(worker.runOnce()).resolves.toBeNull();
  });

  it('rejects invalid claims with fresh contradicting evidence', async () => {
    const { knowledge, ids, node, apply } = await createFixture();
    await knowledge.fileGapFlag({
      claim: 'The source disappeared',
      evidence: ['untrusted citation'],
      targets: [{ type: 'node', id: node.id }],
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    const worker = await knowledge.createGapQueueWorker({
      vouchedScopeIds: [ids['principal:owner']!],
      reviewerContextScopeId: ids['principal:owner']!,
      verify: async () => ({ outcome: 'rejected', evidence: ['fresh-source:still-present'] }),
      apply,
    });

    await expect(worker.runOnce()).resolves.toMatchObject({
      status: 'rejected',
      reviewReason: expect.stringContaining('fresh-source:still-present'),
    });
  });
});
