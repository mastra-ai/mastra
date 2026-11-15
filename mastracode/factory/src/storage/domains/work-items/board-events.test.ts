import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import type { FeedFrame } from '../../../feed-frame.js';
import { factoryDecisionAttentionIdentity, WorkItemsStorage } from './base.js';
import type { FactoryBoardScope, FactoryDeferredDecisionRecord } from './base.js';

const SCOPE = { orgId: 'org1', factoryProjectId: 'p1' };
const NOW = new Date('2030-01-01T00:00:00.000Z');
const LEASE = { ownerId: 'worker-1', now: NOW, leaseExpiresAt: new Date(NOW.getTime() + 30_000), limit: 1 };

const item = { title: 'Fix login', stages: ['intake'], sessions: {}, metadata: {} };

async function makeStorage() {
  const backend = new LibSQLFactoryStorage({ id: `board-events-${Math.random()}`, url: ':memory:' });
  const storage = backend.registerDomain(new WorkItemsStorage());
  await backend.init();
  const announced: FactoryBoardScope[] = [];
  const changes: FeedFrame[] = [];
  const titlesAtAnnounce: Array<Promise<string[]>> = [];
  storage.onBoardChanged((scope, change) => {
    announced.push({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId });
    changes.push(change);
    titlesAtAnnounce.push(storage.list(scope).then(cards => cards.map(card => card.title)));
  });
  return { storage, announced, changes, titlesAtAnnounce };
}

const distinct = (changes: readonly FeedFrame[]) => [...new Set(changes.map(change => JSON.stringify(change)))];
const naming = (...cards: string[]) => [JSON.stringify({ cards })];

async function seedWorkItem(storage: WorkItemsStorage): Promise<string> {
  const created = await storage.upsert({ ...SCOPE, userId: 'u', input: item });
  return created.item.id;
}

type QueuedDecision = Parameters<WorkItemsStorage['commitRuleEvaluation']>[0]['decisions'][number];

const runSkill = (key: string): QueuedDecision => ({
  type: 'invokeSkill',
  role: 'triage',
  skillName: 'factory-triage',
  idempotencyKey: key,
});
const routeClose = (key: string): QueuedDecision => ({
  type: 'routeEvent',
  idempotencyKey: key,
  event: { type: 'work_item.closed' },
});

async function queueDecision(
  storage: WorkItemsStorage,
  workItemId: string,
  key: string,
  decision: QueuedDecision = runSkill(key),
): Promise<void> {
  const workItem = await storage.get({ orgId: SCOPE.orgId, id: workItemId });
  if (!workItem) throw new Error('Expected the seeded work item');
  await storage.commitRuleEvaluation({
    ...SCOPE,
    workItemId,
    ingress: { identity: key, triggerType: 'test' },
    configVersion: 'rules-v1',
    expectedRevision: workItem.revision,
    actor: { type: 'system', id: 'rules' },
    outcome: { status: 'accepted' },
    decisions: [decision],
    causalChain: [],
    now: NOW,
  });
}

async function claim(storage: WorkItemsStorage): Promise<FactoryDeferredDecisionRecord> {
  const [claimed] = await storage.claimDeferredDecisions(LEASE);
  if (!claimed) throw new Error('Expected a claimed decision');
  return claimed;
}

function leaseOf(decision: FactoryDeferredDecisionRecord) {
  return { id: decision.id, orgId: decision.orgId, factoryProjectId: decision.factoryProjectId, ownerId: 'worker-1' };
}

async function failForGood(
  storage: WorkItemsStorage,
  claimed: FactoryDeferredDecisionRecord,
  failureCode: 'session_unavailable' | 'skill_delivery_ambiguous',
): Promise<FactoryDeferredDecisionRecord> {
  const failed = await storage.failDeferredDecision({
    ...leaseOf(claimed),
    now: NOW,
    availableAt: NOW,
    lastError: 'nope',
    failureCode,
    terminal: true,
  });
  if (!failed) throw new Error('Expected a failed decision');
  return failed;
}

describe('board announcements', () => {
  it('announces a new card once a board refetching on it would see the card', async () => {
    const { storage, announced, titlesAtAnnounce } = await makeStorage();

    await seedWorkItem(storage);

    expect(announced).toContainEqual(SCOPE);
    await expect(Promise.all(titlesAtAnnounce)).resolves.toContainEqual(['Fix login']);
  });

  it('announces a card edit', async () => {
    const { storage, announced } = await makeStorage();
    const id = await seedWorkItem(storage);
    announced.length = 0;

    await storage.update({ orgId: SCOPE.orgId, id, userId: 'u', patch: { title: 'Fix logout' } });

    expect(announced).toEqual([SCOPE]);
  });

  it('announces a decision as it is claimed, fails, is claimed again and completes', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'run');
    announced.length = 0;

    const claimed = await claim(storage);
    expect(announced).toEqual([SCOPE]);

    await storage.failDeferredDecision({
      ...leaseOf(claimed),
      now: NOW,
      availableAt: NOW,
      lastError: 'nope',
      failureCode: 'session_unavailable',
      terminal: false,
    });
    expect(announced).toEqual([SCOPE, SCOPE]);

    const reclaimed = await claim(storage);
    expect(announced).toEqual([SCOPE, SCOPE, SCOPE]);
    await storage.completeDeferredDecision(leaseOf(reclaimed), NOW);
    expect(announced).toEqual([SCOPE, SCOPE, SCOPE, SCOPE]);
  });

  it('keeps a lease renewal silent: nothing a board shows moved', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'renew');
    const claimed = await claim(storage);
    announced.length = 0;

    const renewed = await storage.renewDeferredDecisionLease(leaseOf(claimed), new Date(NOW.getTime() + 60_000));

    expect(renewed).toBe(true);
    expect(announced).toEqual([]);
  });

  // The rules page shows a claimed decision as running, so a read taken while it was claimed must be corrected.
  it('announces a route move handed back to wait on its card run, and wakes the dispatcher for its next try', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'close', routeClose('close'));
    const wakes: unknown[] = [];
    storage.onClaimableWork(scope => wakes.push(scope));
    announced.length = 0;

    const claimed = await claim(storage);
    const postponed = await storage.postponeDeferredDecision(leaseOf(claimed), new Date(NOW.getTime() + 10_000), NOW);

    expect(postponed?.status).toBe('pending');
    expect(announced).toEqual([SCOPE, SCOPE]);
    expect(wakes).toEqual([SCOPE]);
  });

  it('announces a run parked for approval, then its approval', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'park');
    const claimed = await claim(storage);
    announced.length = 0;

    const proposed = await storage.proposeDeferredDecision(leaseOf(claimed), NOW);
    expect(announced).toEqual([SCOPE]);

    if (!proposed) throw new Error('Expected a proposed decision');
    await storage.approveDeferredDecision(SCOPE.orgId, SCOPE.factoryProjectId, proposed.id, NOW, 'u');
    expect(announced).toEqual([SCOPE, SCOPE]);
  });

  it('announces a failure nobody will retry, then its return to the queue', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'requeue');
    const claimed = await claim(storage);
    announced.length = 0;

    const failed = await failForGood(storage, claimed, 'session_unavailable');
    expect(announced).toEqual([SCOPE]);

    await storage.retryDeferredDecision(SCOPE.orgId, SCOPE.factoryProjectId, failed.id, NOW);
    expect(announced).toEqual([SCOPE, SCOPE]);
  });

  it('refuses to requeue a failure a rerun cannot fix, and stays quiet', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'ambiguous');
    const failed = await failForGood(storage, await claim(storage), 'skill_delivery_ambiguous');
    announced.length = 0;

    await expect(storage.retryDeferredDecision(SCOPE.orgId, SCOPE.factoryProjectId, failed.id, NOW)).resolves.toBe(
      null,
    );

    expect(await storage.getDeferredDecision(SCOPE.orgId, SCOPE.factoryProjectId, failed.id)).toMatchObject({
      status: 'failed',
      failureCode: 'skill_delivery_ambiguous',
      deliveryGeneration: failed.deliveryGeneration,
    });
    expect(announced).toEqual([]);
  });

  it('announces a superseded proposal, and nothing when none matched', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'supersede');
    await storage.proposeDeferredDecision(leaseOf(await claim(storage)), NOW);
    announced.length = 0;

    await storage.supersedeDecisionsForWorkItem({ ...SCOPE, workItemId, supersededAt: NOW });
    expect(announced).toEqual([SCOPE]);

    await storage.supersedeDecisionsForWorkItem({ ...SCOPE, workItemId, supersededAt: NOW });
    expect(announced).toEqual([SCOPE]);
  });

  it('announces a deleted card', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    announced.length = 0;

    await storage.delete({ orgId: SCOPE.orgId, id: workItemId });

    expect(announced).toEqual([SCOPE]);
  });

  it('keeps a read receipt to itself: nobody else’s board changed', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'receipt');
    const failed = await failForGood(storage, await claim(storage), 'session_unavailable');
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

  it('names the card a new card, an edit and a delete changed, so a board rereads that card alone', async () => {
    const { storage, changes } = await makeStorage();
    const id = await seedWorkItem(storage);
    expect(distinct(changes)).toEqual(naming(id));
    changes.length = 0;

    await storage.update({ orgId: SCOPE.orgId, id, userId: 'u', patch: { title: 'Fix logout' } });
    expect(distinct(changes)).toEqual(naming(id));
    changes.length = 0;

    await storage.delete({ orgId: SCOPE.orgId, id });
    expect(distinct(changes)).toEqual(naming(id));
  });

  it('names no card for a decision write, which moves no card', async () => {
    const { storage, changes } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'naming');
    changes.length = 0;

    await claim(storage);

    expect(changes).toEqual([{ cards: [] }]);
  });

  it('names the card a stage move moved inside its transaction', async () => {
    const { storage, changes } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    const workItem = await storage.get({ orgId: SCOPE.orgId, id: workItemId });
    if (!workItem) throw new Error('Expected the seeded work item');
    changes.length = 0;

    await storage.commitTransition({
      ...SCOPE,
      workItemId,
      expectedRevision: workItem.revision,
      destinationStage: 'plan',
      actorId: 'user-alice',
      ingress: { identity: 'move-1', triggerType: 'human', transitionId: 'move-1' },
      configVersion: 'rules-v1',
      causalChain: [],
      evaluation: { outcome: 'accepted', decisions: [] },
    });

    expect(changes).toEqual([{ cards: [workItemId] }]);
  });

  it('names the card a source refresh changed, though only its source row moved', async () => {
    const { storage, changes } = await makeStorage();
    const externalSource = { integrationId: 'github', type: 'issue', externalId: '42' };
    const created = await storage.upsert({ ...SCOPE, userId: 'u', input: { ...item, externalSource } });
    const source = created.item.workItem.sources[0];
    if (!source) throw new Error('Expected the seeded source');
    changes.length = 0;

    await storage.syncWorkItemSource({
      ...SCOPE,
      provider: source.provider,
      externalId: source.externalId,
      patch: { state: 'closed' },
    });

    expect(changes).toEqual([{ cards: [created.item.id] }]);
  });

  it('keeps the shared card list cached across a decision write, which moves no card', async () => {
    const { storage } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'cache');
    const before = await storage.listShared(SCOPE);

    await claim(storage);

    expect(await storage.listShared(SCOPE)).toBe(before);
  });
});
