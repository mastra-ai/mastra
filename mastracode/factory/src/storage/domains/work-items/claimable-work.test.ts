/**
 * The wake an idle dispatcher sleeps on: every write that leaves a pending
 * start or deferred decision claimable must announce it, after commit, or the
 * work waits until something else wakes the dispatcher.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';

import { WorkItemsStorage } from './base.js';
import type { FactoryClaimableWorkScope, FactoryDeferredDecisionRecord } from './base.js';
import * as boardVersion from './board-version.js';

vi.mock('./board-version.js', async importOriginal => {
  const actual = await importOriginal<typeof import('./board-version.js')>();
  return { ...actual, bumpBoardVersions: vi.fn(actual.bumpBoardVersions) };
});

const SCOPE = { orgId: 'org1', factoryProjectId: 'p1' };
const NOW = new Date('2030-01-01T00:00:00.000Z');
const LEASE = { ownerId: 'worker-1', now: NOW, leaseExpiresAt: new Date(NOW.getTime() + 30_000), limit: 1 };
const LATER = new Date(NOW.getTime() + 60_000);

async function makeStorage() {
  const backend = new LibSQLFactoryStorage({ id: `claimable-work-${Math.random()}`, url: ':memory:' });
  const storage = backend.registerDomain(new WorkItemsStorage());
  await backend.init();
  const woken: FactoryClaimableWorkScope[] = [];
  // What the listener can read is what a woken dispatcher would claim.
  const visibleAtWake: Array<Promise<number>> = [];
  storage.onClaimableWork(scope => {
    woken.push({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId });
    visibleAtWake.push(storage.nextClaimableAt().then(at => (at ? 1 : 0)));
  });
  return { storage, woken, visibleAtWake };
}

async function seedWorkItem(storage: WorkItemsStorage): Promise<string> {
  const created = await storage.upsert({
    ...SCOPE,
    userId: 'u',
    input: { title: 'Fix login', stages: ['intake'], sessions: {}, metadata: {} },
  });
  return created.item.id;
}

async function queueDecision(storage: WorkItemsStorage, workItemId: string, key: string): Promise<void> {
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
    decisions: [{ type: 'invokeSkill', role: 'triage', skillName: 'factory-triage', idempotencyKey: key }],
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

async function prepareStart(storage: WorkItemsStorage, workItemId: string) {
  return storage.prepareRunStart({
    ...SCOPE,
    userId: 'u',
    workItem: {
      id: workItemId,
      input: { title: 'Fix login', stages: ['execute'], sessions: {}, metadata: {} },
    },
    role: 'work',
    session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: SCOPE.factoryProjectId,
    kickoffKey: 'kickoff-1',
    kickoffMessage: 'Start.',
  });
}

describe('claimable-work wakes', () => {
  it('wakes after a queued decision commits, with the row already visible', async () => {
    const { storage, woken, visibleAtWake } = await makeStorage();
    await queueDecision(storage, await seedWorkItem(storage), 'queued');

    expect(woken).toEqual([SCOPE]);
    expect(await Promise.all(visibleAtWake)).toEqual([1]);
  });

  it('wakes after a run start is prepared, and not when it is claimed or marked sent', async () => {
    const { storage, woken } = await makeStorage();
    const prepared = await prepareStart(storage, await seedWorkItem(storage));
    expect(woken).toEqual([SCOPE]);

    await storage.claimPendingStarts(LEASE);
    await storage.markPendingStart(prepared.binding.id, 'sent');
    expect(woken).toEqual([SCOPE]);
  });

  it('wakes on a retryable failure, not on a terminal one', async () => {
    const { storage, woken } = await makeStorage();
    await queueDecision(storage, await seedWorkItem(storage), 'fail');
    const failure = { now: NOW, availableAt: NOW, lastError: 'nope', failureCode: 'session_unavailable' } as const;
    woken.length = 0;

    await storage.failDeferredDecision({ ...leaseOf(await claim(storage)), ...failure, terminal: false });
    expect(woken).toEqual([SCOPE]);

    await storage.failDeferredDecision({ ...leaseOf(await claim(storage)), ...failure, terminal: true });
    expect(woken).toEqual([SCOPE]);
  });

  it('wakes on a manual retry and on an approval, not on parking for approval', async () => {
    const { storage, woken } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    await queueDecision(storage, workItemId, 'manual');
    const failed = await storage.failDeferredDecision({
      ...leaseOf(await claim(storage)),
      now: NOW,
      availableAt: NOW,
      lastError: 'nope',
      failureCode: 'session_unavailable',
      terminal: true,
    });
    if (!failed) throw new Error('Expected a failed decision');
    woken.length = 0;

    await storage.retryDeferredDecision(SCOPE.orgId, SCOPE.factoryProjectId, failed.id, NOW);
    expect(woken).toEqual([SCOPE]);

    const proposed = await storage.proposeDeferredDecision(leaseOf(await claim(storage)), NOW);
    if (!proposed) throw new Error('Expected a proposed decision');
    expect(woken).toEqual([SCOPE]);

    await storage.approveDeferredDecision(SCOPE.orgId, SCOPE.factoryProjectId, proposed.id, NOW, 'u');
    expect(woken).toEqual([SCOPE, SCOPE]);
  });

  it('still wakes when the post-commit board version bump fails', async () => {
    const { storage, woken, visibleAtWake } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    woken.length = 0;
    visibleAtWake.length = 0;
    vi.mocked(boardVersion.bumpBoardVersions).mockRejectedValueOnce(new Error('transient'));

    // A run start moves its card, so its commit has a board to bump.
    await expect(prepareStart(storage, workItemId)).rejects.toThrow('transient');
    expect(woken).toEqual([SCOPE]);
    expect(await Promise.all(visibleAtWake)).toEqual([1]);
  });

  it('a throwing listener neither fails the committed write nor skips later listeners', async () => {
    const { storage, woken } = await makeStorage();
    const workItemId = await seedWorkItem(storage);
    woken.length = 0;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.onClaimableWork(() => {
      throw new Error('publish failed');
    });
    const later: FactoryClaimableWorkScope[] = [];
    storage.onClaimableWork(scope => later.push({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId }));

    await expect(queueDecision(storage, workItemId, 'listener-throws')).resolves.toBeUndefined();
    expect(woken).toEqual([SCOPE]);
    expect(later).toEqual([SCOPE]);
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

describe('nextClaimableAt', () => {
  it('is null with nothing queued or leased', async () => {
    const { storage } = await makeStorage();
    expect(await storage.nextClaimableAt()).toBeNull();
  });

  it('is a delayed retry’s availability, then null once it settles', async () => {
    const { storage } = await makeStorage();
    await queueDecision(storage, await seedWorkItem(storage), 'delayed');
    const failed = await storage.failDeferredDecision({
      ...leaseOf(await claim(storage)),
      now: NOW,
      availableAt: LATER,
      lastError: 'nope',
      failureCode: 'session_unavailable',
      terminal: false,
    });
    expect(failed?.status).toBe('retry');
    expect(await storage.nextClaimableAt()).toEqual(LATER);

    const [reclaimed] = await storage.claimDeferredDecisions({ ...LEASE, now: LATER });
    if (!reclaimed) throw new Error('Expected the retry to be claimable once due');
    await storage.completeDeferredDecision(leaseOf(reclaimed), LATER);
    expect(await storage.nextClaimableAt()).toBeNull();
  });

  it('is a leased row’s lease expiry, so a crashed dispatcher’s work is recovered', async () => {
    const { storage } = await makeStorage();
    await prepareStart(storage, await seedWorkItem(storage));
    await storage.claimPendingStarts(LEASE);

    expect(await storage.nextClaimableAt()).toEqual(LEASE.leaseExpiresAt);
  });
});
