import { describe, expect, it, vi } from 'vitest';

import { Knowledge } from '../..';
import { InMemoryStore } from '../../../storage';

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
      {
        address: 'scope:other',
        name: 'Other',
        grants: [
          { scopeRefAddress: 'principal:suggest', role: 'readonly', canSuggest: true },
          { scopeRefAddress: 'principal:owner', role: 'owner' },
        ],
      },
    ],
  });
  const ids = structure.scopes;
  const node = await storage.createNode({ name: 'Current claim', scopeIds: [ids['scope:feature']!] });
  return { knowledge, storage, ids, node };
}

describe('Knowledge gap flags', () => {
  it('re-verifies one pending flag without passing proposer evidence and applies under worker authority', async () => {
    const { knowledge, storage, ids, node } = await createFixture();
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

  it('rejects a verified mutation whose target was not bound to the gap flag', async () => {
    const { knowledge, storage, ids, node } = await createFixture();
    const unrelated = await storage.createNode({ name: 'Unrelated claim', scopeIds: [ids['scope:feature']!] });
    const flag = await knowledge.fileGapFlag({
      claim: 'The title is stale',
      evidence: [],
      targets: [{ type: 'node', id: node.id }],
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    const worker = await knowledge.createGapQueueWorker({
      vouchedScopeIds: [ids['principal:owner']!],
      reviewerContextScopeId: ids['principal:owner']!,
      verify: async () => ({
        outcome: 'verified',
        evidence: ['fresh-source:revision-2'],
        mutation: {
          kind: 'update-node',
          mutation: { id: unrelated.id, version: unrelated.version, name: 'Injected title' },
        },
      }),
    });

    await expect(worker.runOnce()).rejects.toThrow('was not bound to the gap flag');
    await expect(storage.getNode(unrelated.id)).resolves.toMatchObject({
      name: 'Unrelated claim',
      version: unrelated.version,
    });
    await expect(storage.getProposal(flag.id)).resolves.toMatchObject({ status: 'pending' });
  });

  it('requires structural scope targets to be bound before applying a verified move', async () => {
    const { knowledge, storage, ids, node } = await createFixture();
    const flag = await knowledge.fileGapFlag({
      claim: 'The node belongs elsewhere',
      evidence: [],
      targets: [{ type: 'node', id: node.id }],
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    const worker = await knowledge.createGapQueueWorker({
      vouchedScopeIds: [ids['principal:owner']!],
      reviewerContextScopeId: ids['principal:owner']!,
      verify: async () => ({
        outcome: 'verified',
        evidence: ['fresh-source:placement'],
        mutation: {
          kind: 'move-node',
          mutation: { id: node.id, version: node.version, scopeIds: [ids['scope:other']!] },
        },
      }),
    });

    await expect(worker.runOnce()).rejects.toThrow('was not bound to the gap flag');
    await expect(storage.getNodeScopeIds(node.id)).resolves.toEqual([ids['scope:feature']]);
    await expect(storage.getProposal(flag.id)).resolves.toMatchObject({ status: 'pending' });
  });

  it('always escalates protected scopes and notifies without invoking the verifier', async () => {
    const { knowledge, ids, node } = await createFixture();
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
      notifyEscalation,
    });

    await expect(worker.runOnce()).resolves.toMatchObject({ status: 'escalated' });
    expect(verify).not.toHaveBeenCalled();
    expect(notifyEscalation).toHaveBeenCalledWith(expect.objectContaining({ status: 'escalated' }));
    await expect(worker.runOnce()).resolves.toBeNull();
  });

  it('rejects invalid claims with fresh contradicting evidence', async () => {
    const { knowledge, ids, node } = await createFixture();
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
    });

    await expect(worker.runOnce()).resolves.toMatchObject({
      status: 'rejected',
      reviewReason: expect.stringContaining('fresh-source:still-present'),
    });
  });

  it('pages past newer ordinary proposals instead of starving an older gap flag', async () => {
    const { knowledge, storage, ids, node } = await createFixture();
    const flag = await knowledge.fileGapFlag({
      claim: 'An older gap still needs verification',
      evidence: [],
      targets: [{ type: 'node', id: node.id }],
      proposerContextScopeId: ids['principal:suggest']!,
      vouchedScopeIds: [ids['principal:suggest']!],
    });
    const target = {
      type: 'node' as const,
      id: node.id,
      expectedVersion: node.version,
      scopeIds: [ids['scope:feature']!],
      approvalCapability: 'edit' as const,
    };
    for (let index = 0; index < 101; index++) {
      await storage.createProposal({
        targets: [target],
        operation: 'update-node',
        payload: { kind: 'update-node', mutation: { id: node.id, version: node.version, name: `Pending ${index}` } },
        proposerContextScopeId: ids['principal:suggest']!,
        expectedAccessEpoch: await storage.getAccessEpoch(),
      });
    }
    const worker = await knowledge.createGapQueueWorker({
      vouchedScopeIds: [ids['principal:owner']!],
      reviewerContextScopeId: ids['principal:owner']!,
      verify: async () => ({
        outcome: 'rejected',
        evidence: ['fresh-source:contradiction'],
      }),
    });

    await expect(worker.runOnce()).resolves.toMatchObject({ id: flag.id, status: 'rejected' });
  });
});
