/**
 * The announcement every attention-changing write owes its readers: clients
 * stop polling while their feed stream is up, so a write that stays silent
 * leaves every open page stale until it is reloaded.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import { factoryDecisionAttentionIdentity, WorkItemsStorage } from './base.js';
import type { FactoryAttentionScope, FactoryDeferredDecisionRecord } from './base.js';

const SCOPE = { orgId: 'org1', factoryProjectId: 'p1' };
const NOW = new Date('2030-01-01T00:00:00.000Z');
const LEASE = { ownerId: 'worker-1', now: NOW, leaseExpiresAt: new Date(NOW.getTime() + 30_000), limit: 1 };

const item = { title: 'Fix login', stages: ['intake'], sessions: {}, metadata: {} };

async function makeStorage(): Promise<{ storage: WorkItemsStorage; announced: FactoryAttentionScope[] }> {
  const backend = new LibSQLFactoryStorage({ id: `attention-events-${Math.random()}`, url: ':memory:' });
  const storage = backend.registerDomain(new WorkItemsStorage());
  await backend.init();
  const announced: FactoryAttentionScope[] = [];
  storage.onAttentionChanged(scope => announced.push({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId }));
  return { storage, announced };
}

async function seedWorkItem(storage: WorkItemsStorage): Promise<string> {
  const created = await storage.upsert({ ...SCOPE, userId: 'u', input: item });
  return created.item.id;
}

async function claimDecision(
  storage: WorkItemsStorage,
  workItemId: string,
  key: string,
): Promise<FactoryDeferredDecisionRecord> {
  const workItem = await storage.get({ orgId: SCOPE.orgId, id: workItemId });
  if (!workItem) throw new Error('Expected the seeded work item');
  await storage.commitRuleEvaluation({
    ...SCOPE,
    workItemId,
    ingress: { identity: key, triggerType: 'test' },
    ruleSetVersion: 'rules-v1',
    expectedRevision: workItem.revision,
    actor: { type: 'system', id: 'rules' },
    outcome: { status: 'accepted' },
    decisions: [{ type: 'invokeSkill', role: 'triage', skillName: 'factory-triage', idempotencyKey: key }],
    causalChain: [],
    now: NOW,
  });
  const [claimed] = await storage.claimDeferredDecisions(LEASE);
  if (!claimed) throw new Error('Expected a claimed decision');
  return claimed;
}

function leaseOf(decision: FactoryDeferredDecisionRecord) {
  return {
    id: decision.id,
    orgId: decision.orgId,
    factoryProjectId: decision.factoryProjectId,
    ownerId: 'worker-1',
  };
}

describe('attention announcements', () => {
  it('announces a run parked for approval, then its approval', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    const claimed = await claimDecision(storage, workItemId, 'park');

    const proposed = await storage.proposeDeferredDecision(leaseOf(claimed), NOW);
    expect(announced).toEqual([SCOPE]);

    if (!proposed) throw new Error('Expected a proposed decision');
    await storage.approveDeferredDecision(SCOPE.orgId, SCOPE.factoryProjectId, proposed.id, NOW, 'u');
    expect(announced).toEqual([SCOPE, SCOPE]);
  });

  it('stays quiet on a retryable failure and announces the terminal one', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    const claimed = await claimDecision(storage, workItemId, 'fail');
    const failure = { now: NOW, availableAt: NOW, lastError: 'nope', failureCode: 'session_unavailable' } as const;

    await storage.failDeferredDecision({ ...leaseOf(claimed), ...failure, terminal: false });
    expect(announced).toEqual([]);

    const [reclaimed] = await storage.claimDeferredDecisions(LEASE);
    if (!reclaimed) throw new Error('Expected the decision back on the queue');
    await storage.failDeferredDecision({ ...leaseOf(reclaimed), ...failure, terminal: true });
    expect(announced).toEqual([SCOPE]);
  });

  it('announces a failed decision going back on the queue', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    const claimed = await claimDecision(storage, workItemId, 'retry');
    const failed = await storage.failDeferredDecision({
      ...leaseOf(claimed),
      now: NOW,
      availableAt: NOW,
      lastError: 'nope',
      failureCode: 'session_unavailable',
      terminal: true,
    });
    if (!failed) throw new Error('Expected a failed decision');
    announced.length = 0;

    await storage.retryDeferredDecision(SCOPE.orgId, SCOPE.factoryProjectId, failed.id, NOW);
    expect(announced).toEqual([SCOPE]);
  });

  it('announces a superseded proposal, and nothing when none matched', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    const claimed = await claimDecision(storage, workItemId, 'supersede');
    await storage.proposeDeferredDecision(leaseOf(claimed), NOW);
    announced.length = 0;

    await storage.supersedeDecisionsForWorkItem({ ...SCOPE, workItemId, supersededAt: NOW });
    expect(announced).toEqual([SCOPE]);

    await storage.supersedeDecisionsForWorkItem({ ...SCOPE, workItemId, supersededAt: NOW });
    expect(announced).toEqual([SCOPE]);
  });

  it('announces a deleted work item, taking its attention with it', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);

    await storage.delete({ orgId: SCOPE.orgId, id: workItemId });
    expect(announced).toEqual([SCOPE]);
  });

  it('keeps a read receipt to itself: nobody else’s list changed', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    const claimed = await claimDecision(storage, workItemId, 'receipt');
    const failed = await storage.failDeferredDecision({
      ...leaseOf(claimed),
      now: NOW,
      availableAt: NOW,
      lastError: 'nope',
      failureCode: 'session_unavailable',
      terminal: true,
    });
    if (!failed) throw new Error('Expected a failed decision');
    announced.length = 0;

    await storage.setAttentionReceipt({
      ...SCOPE,
      userId: 'u',
      identity: factoryDecisionAttentionIdentity(failed.id, failed.failureOccurrence),
      action: 'read',
      now: NOW,
    });
    expect(announced).toEqual([]);
  });
});
