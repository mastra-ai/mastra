/**
 * The announcement every board-visible write owes open boards: they stop
 * polling while their feed stream is up, so a card or decision write that stays
 * silent leaves every board stale until its slow safety poll.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import { WorkItemsStorage } from './base.js';
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
  // What the listener can read is what a board refetching on the frame would show.
  const titlesAtAnnounce: Array<Promise<string[]>> = [];
  storage.onBoardChanged(scope => {
    announced.push({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId });
    titlesAtAnnounce.push(storage.list(scope).then(cards => cards.map(card => card.title)));
  });
  return { storage, announced, titlesAtAnnounce };
}

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

  it('announces a decision as it is claimed, fails for a retry, and completes', async () => {
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
    announced.length = 0;
    await storage.completeDeferredDecision(leaseOf(reclaimed), NOW);
    expect(announced).toEqual([SCOPE]);
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

  it('keeps a route move waiting on its card run silent, yet still wakes the dispatcher for its next try', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'close', routeClose('close'));
    const wakes: unknown[] = [];
    storage.onClaimableWork(scope => wakes.push(scope));
    announced.length = 0;

    const claimed = await claim(storage);
    const postponed = await storage.postponeDeferredDecision(leaseOf(claimed), new Date(NOW.getTime() + 10_000), NOW);

    expect(postponed?.status).toBe('pending');
    expect(announced).toEqual([]);
    expect(wakes).toEqual([SCOPE]);
  });

  it('announces a route move claimed again after a failure, since its retry warning clears', async () => {
    const { storage, announced } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'close', routeClose('close'));
    const claimed = await claim(storage);
    await storage.failDeferredDecision({
      ...leaseOf(claimed),
      now: NOW,
      availableAt: NOW,
      lastError: 'nope',
      failureCode: 'session_unavailable',
      terminal: false,
    });
    announced.length = 0;

    await claim(storage);

    expect(announced).toEqual([SCOPE]);
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
