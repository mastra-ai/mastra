/**
 * Work-items domain over a real backend (libsql `:memory:`): external-source
 * dedup scoping and the atomic update path.
 */

import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  applyStageTransition,
  factoryDecisionAttentionIdentity,
  isAgentActor,
  WorkItemRelationError,
  WorkItemsStorage,
} from './base.js';
import type { WorkItemStageEntry } from './base.js';

const input = {
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: '42',
  },
  title: 'Fix login',
  stages: ['intake'],
  sessions: {},
  metadata: {},
};

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

async function makeStorage(): Promise<WorkItemsStorage> {
  const backend = new LibSQLFactoryStorage({ id: 'work-items-test', url: ':memory:' });
  const domain = backend.registerDomain(new WorkItemsStorage());
  await backend.init();
  return domain;
}

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Runs the domain's transactional work against instrumented ops.
 *
 * Two things make this necessary. `withTransaction` hands its callback a freshly
 * built ops object rather than `backend.ops`, so spying on `backend.ops` never
 * observes relationship writes. And the real implementation wraps every
 * transaction in the libsql client write lock, which serializes writes on its
 * own and would mask whether the domain's own project lock does anything. This
 * replacement keeps the `:memory:` semantics (that path runs the callback
 * without opening a transaction) while dropping the client write lock, so the
 * in-process project lock is the only thing left ordering these writes.
 */
function interceptTransactionOps(backend: any, overridesFor: (ops: any) => Record<string, unknown>): void {
  vi.spyOn(backend, 'withTransaction').mockImplementation((fn: any) => {
    const ops = backend.ops;
    const overrides = overridesFor(ops);
    return fn(
      new Proxy(ops, {
        get(target, prop, receiver) {
          if (prop in overrides) return overrides[prop as string];
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }),
    );
  });
}

describe('WorkItemsStorage', () => {
  it('clears every reference to a deleted session without touching other refs, items, or orgs', async () => {
    const storage = await makeStorage();
    const ref = (sessionId: string) => ({ sessionId, branch: `factory/${sessionId}`, threadId: `${sessionId}-thread` });
    const touched = await storage.upsert({
      orgId: 'org1',
      userId: 'user1',
      factoryProjectId: 'project1',
      input: { ...input, sessions: { work: ref('sess-dead'), review: ref('sess-live') } },
    });
    const untouched = await storage.upsert({
      orgId: 'org1',
      userId: 'user1',
      factoryProjectId: 'project1',
      input: {
        ...input,
        externalSource: { ...input.externalSource, externalId: '43' },
        sessions: { review: ref('sess-live') },
      },
    });
    const otherOrg = await storage.upsert({
      orgId: 'org2',
      userId: 'user1',
      factoryProjectId: 'project2',
      input: { ...input, sessions: { work: ref('sess-dead') } },
    });

    const cleared = await storage.clearSessionReferences({ orgId: 'org1', sessionId: 'sess-dead' });

    expect(cleared).toBe(1);
    const touchedAfter = await storage.get({ orgId: 'org1', id: touched.item.id });
    expect(Object.keys(touchedAfter!.sessions)).toEqual(['review']);
    expect(touchedAfter!.revision).toBe(touched.item.revision + 1);
    const untouchedAfter = await storage.get({ orgId: 'org1', id: untouched.item.id });
    expect(untouchedAfter!.revision).toBe(untouched.item.revision);
    const otherOrgAfter = await storage.get({ orgId: 'org2', id: otherOrg.item.id });
    expect(otherOrgAfter!.sessions.work?.sessionId).toBe('sess-dead');
  });

  it('persists a triage classification atomically, revisions it once, and replays without changing it', async () => {
    const storage = await makeStorage();
    const created = await storage.upsert({ orgId: 'org1', userId: 'user1', factoryProjectId: 'project1', input });
    const commit = (identity: string, expectedRevision: number, triageType: 'feature request' | 'bug') =>
      storage.commitTransition({
        orgId: 'org1',
        factoryProjectId: 'project1',
        workItemId: created.item.id,
        expectedRevision,
        destinationStage: 'intake',
        actorId: 'triage-agent',
        ingress: { identity, triggerType: 'agent', transitionId: identity },
        configVersion: 'rules-v1',
        causalChain: [],
        evaluation: { outcome: 'accepted', decisions: [] },
        triageType,
      });

    const classified = await commit('triage-1', created.item.revision, 'feature request');
    expect(classified).toMatchObject({ status: 'committed', item: { triageType: 'feature request', revision: 2 } });
    const replayed = await commit('triage-1', created.item.revision, 'feature request');
    expect(replayed).toMatchObject({ status: 'replayed', item: { triageType: 'feature request', revision: 2 } });
    const laterAgent = await commit('triage-2', 2, 'bug');
    expect(laterAgent).toMatchObject({ status: 'committed', item: { triageType: 'feature request', revision: 2 } });
  });

  it('deduplicates external sources within a Factory project, not across projects', async () => {
    const storage = await makeStorage();

    const first = await storage.upsert({ orgId: 'org1', userId: 'user1', factoryProjectId: 'project1', input });
    const otherProject = await storage.upsert({
      orgId: 'org1',
      userId: 'user2',
      factoryProjectId: 'project2',
      input,
    });
    const reused = await storage.upsert({
      orgId: 'org1',
      userId: 'user3',
      factoryProjectId: 'project1',
      input: { ...input, title: 'Updated title' },
    });

    expect(first.created).toBe(true);
    expect(otherProject.created).toBe(true);
    expect(otherProject.item.id).not.toBe(first.item.id);
    expect(reused.created).toBe(false);
    expect(reused.item.id).toBe(first.item.id);
    expect(reused.item.title).toBe('Updated title');
  });

  it('lists every card in the org linked from one external source', async () => {
    const storage = await makeStorage();
    const first = await storage.upsert({ orgId: 'org1', userId: 'user1', factoryProjectId: 'project1', input });
    const second = await storage.upsert({ orgId: 'org1', userId: 'user1', factoryProjectId: 'project2', input });
    await storage.upsert({ orgId: 'org2', userId: 'user1', factoryProjectId: 'project9', input });
    await storage.upsert({
      orgId: 'org1',
      userId: 'user1',
      factoryProjectId: 'project1',
      input: { ...input, externalSource: { ...input.externalSource, externalId: '43' } },
    });

    const rows = await storage.listBySource({ orgId: 'org1', source: input.externalSource });

    expect(rows.map(row => row.id).sort()).toEqual([first.item.id, second.item.id].sort());
    expect(rows.every(row => row.orgId === 'org1')).toBe(true);
  });

  it('mints a fresh binding when re-entered after the prior binding is revoked', async () => {
    const storage = await makeStorage();
    const start = (kickoffKey: string) =>
      storage.prepareRunStart({
        orgId: 'org1',
        userId: 'user1',
        factoryProjectId: 'project1',
        workItem: { input: { ...input } },
        role: 'work',
        session: { sessionId: `session-${kickoffKey}`, branch: 'factory/42', threadId: `thread-${kickoffKey}` },
        resourceId: 'resource-1',
        kickoffKey,
        kickoffMessage: null,
      });

    const first = await start('kickoff-1');
    expect(first.replayed).toBe(false);
    expect(first.binding.status).toBe('active');

    // Abort recovery: revoke the item's bindings, then re-enter with the same key.
    await storage.revokeRunBindingsForWorkItem({
      orgId: 'org1',
      factoryProjectId: 'project1',
      workItemId: first.item.id,
      revokedAt: new Date(),
    });

    const second = await start('kickoff-1');
    expect(second.replayed).toBe(false);
    expect(second.binding.id).not.toBe(first.binding.id);
    expect(second.binding.status).toBe('active');
    expect(second.pendingStart.bindingId).toBe(second.binding.id);
  });

  it("revokes an earlier role's binding when a later role continues in its session", async () => {
    const storage = await makeStorage();
    const start = (role: string, threadId: string) =>
      storage.prepareRunStart({
        orgId: 'org1',
        userId: 'user1',
        factoryProjectId: 'project1',
        workItem: { input: { ...input } },
        role,
        session: { sessionId: 'session-shared', branch: 'factory/42', threadId },
        resourceId: 'resource-1',
        kickoffKey: `kickoff-${role}`,
        kickoffMessage: null,
      });

    const plan = await start('plan', 'thread-plan');
    const work = await start('work', 'thread-work');

    const bindings = await storage.listRunBindings('org1', 'project1', work.item.id);
    expect(bindings.find(binding => binding.id === plan.binding.id)?.status).toBe('revoked');
    expect(bindings.find(binding => binding.id === work.binding.id)?.status).toBe('active');
  });

  it('replays the same binding when re-entered while it is still live', async () => {
    const storage = await makeStorage();
    const start = (kickoffKey: string) =>
      storage.prepareRunStart({
        orgId: 'org1',
        userId: 'user1',
        factoryProjectId: 'project1',
        workItem: { input: { ...input } },
        role: 'work',
        session: { sessionId: `session-${kickoffKey}`, branch: 'factory/42', threadId: `thread-${kickoffKey}` },
        resourceId: 'resource-1',
        kickoffKey,
        kickoffMessage: null,
      });

    const first = await start('kickoff-1');
    expect(first.replayed).toBe(false);

    const second = await start('kickoff-1');
    expect(second.replayed).toBe(true);
    expect(second.binding.id).toBe(first.binding.id);
  });

  it('purges replay state when a linked work item is deleted', async () => {
    const storage = await makeStorage();
    const scope = { orgId: 'org1', factoryProjectId: 'p1' };
    const created = await storage.upsert({
      ...scope,
      userId: 'u',
      input: { ...input, externalSource: { ...input.externalSource, externalId: 'github-issue:42' } },
    });
    const commit = () =>
      storage.commitRuleEvaluation({
        ...scope,
        workItemId: null,
        ingress: { identity: 'linear:issue:ENG-1:1', triggerType: 'issue.observed' },
        configVersion: 'v1',
        expectedRevision: null,
        actor: { type: 'system', id: 'rules' },
        outcome: { status: 'accepted' },
        decisions: [
          {
            type: 'upsertLinkedWorkItem',
            source: 'github-issue',
            sourceKey: 'github-issue:42',
            idempotencyKey: 'decision-1',
            board: 'work',
            stage: 'triage',
          } as never,
        ],
        causalChain: [],
        now: new Date(),
      });

    expect((await commit()).status).toBe('committed');
    const now = new Date('2030-01-01T00:00:00.000Z');
    const [claimed] = await storage.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    if (!claimed) throw new Error('Expected a claimable decision');
    await storage.completeDeferredDecision(
      { orgId: 'org1', factoryProjectId: 'p1', id: claimed.id, ownerId: 'worker-1' },
      now,
    );

    // The card still exists, so the replayed ingress leaves the spent decision alone
    // instead of re-leasing work that already happened.
    expect((await commit()).status).toBe('replayed');
    const [spent] = await storage.listDeferredDecisions('org1', 'p1');
    expect(spent).toMatchObject({ idempotencyKey: 'decision-1', status: 'succeeded' });

    await storage.delete({ orgId: 'org1', id: created.item.id });

    // Stale ingress no longer short-circuits, so nothing resurrects the deleted card.
    expect((await commit()).status).toBe('committed');
  });

  it('persists nothing for a stale rule evaluation, so the same delivery can commit at the fresh revision', async () => {
    const storage = await makeStorage();
    const created = await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });
    const commit = (expectedRevision: number) =>
      storage.commitRuleEvaluation({
        orgId: 'org1',
        factoryProjectId: 'p1',
        workItemId: created.item.id,
        ingress: { identity: 'github:delivery-1', triggerType: 'github.issueComment' },
        configVersion: 'v1',
        expectedRevision,
        actor: { type: 'system', id: 'rules' },
        outcome: { status: 'accepted' },
        decisions: [{ type: 'transition', stage: 'done', idempotencyKey: 'decision-1' }] as never,
        causalChain: [],
        now: new Date(),
      });

    expect(await commit(created.item.revision - 1)).toEqual({ status: 'stale' });
    expect(await storage.listDeferredDecisions('org1', 'p1')).toEqual([]);

    const fresh = await commit(created.item.revision);
    expect(fresh.status).toBe('committed');
    expect(fresh.status === 'committed' && fresh.result).toMatchObject({ status: 'accepted' });
    expect((await storage.listDeferredDecisions('org1', 'p1')).map(d => d.idempotencyKey)).toEqual(['decision-1']);

    const other = await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: { ...input, externalSource: { integrationId: 'github', type: 'issue', externalId: 'other-card' } },
    });
    await storage.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: 'p1',
      workItemId: other.item.id,
      ingress: { identity: 'github:delivery-2', triggerType: 'github.issueComment' },
      configVersion: 'v1',
      expectedRevision: other.item.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'transition', stage: 'done', idempotencyKey: 'decision-2' }] as never,
      causalChain: [],
      now: new Date(),
    });
    const forCard = async (workItemId: string) =>
      (await storage.listDeferredDecisions('org1', 'p1', { workItemId })).map(d => d.idempotencyKey);
    expect(await forCard(created.item.id)).toEqual(['decision-1']);
    expect(await forCard(other.item.id)).toEqual(['decision-2']);
    expect(await forCard('some-other-card')).toEqual([]);
  });

  it('claims deferred decisions by payload filter, paging past any backlog of filtered-out rows', async () => {
    const storage = await makeStorage();
    const scope = { orgId: 'org1', factoryProjectId: 'p1' };
    const runDecisions = Array.from({ length: 700 }, (_, index) => ({
      type: 'invokeSkill',
      role: 'work',
      skillName: 'triage',
      idempotencyKey: `run-${index}`,
    }));
    const commitResult = await storage.commitRuleEvaluation({
      ...scope,
      workItemId: null,
      ingress: { identity: 'github:issue:1:1', triggerType: 'issue.observed' },
      configVersion: 'v1',
      expectedRevision: null,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [...runDecisions, { type: 'transition', stage: 'done', idempotencyKey: 'bookkeeping-1' }] as never,
      causalChain: [],
      now: new Date(),
    });
    expect(commitResult.status).toBe('committed');
    const now = new Date('2030-01-01T00:00:00.000Z');
    const lease = { ownerId: 'worker-1', now, leaseExpiresAt: new Date(now.getTime() + 30_000) };

    const bookkeeping = await storage.claimDeferredDecisions({
      ...lease,
      limit: 5,
      decisionFilter: decision => decision.type !== 'invokeSkill',
    });
    expect(bookkeeping.map(d => d.idempotencyKey)).toEqual(['bookkeeping-1']);

    const runs = await storage.claimDeferredDecisions({
      ...lease,
      limit: 3,
      decisionFilter: decision => decision.type === 'invokeSkill',
    });
    expect(runs.map(d => d.decision.type)).toEqual(['invokeSkill', 'invokeSkill', 'invokeSkill']);

    const all = await storage.listDeferredDecisions('org1', 'p1');
    expect(all.filter(d => d.status === 'leased')).toHaveLength(4);
    expect(all.filter(d => d.status === 'pending')).toHaveLength(697);

    const leased = await storage.listDeferredDecisions('org1', 'p1', { statuses: ['leased'] });
    expect(leased).toHaveLength(4);
    expect(leased.every(d => d.status === 'leased')).toBe(true);
    expect(await storage.listDeferredDecisions('org1', 'p1', { statuses: ['failed'] })).toEqual([]);
  });

  it('lists newest-first within the org/project scope and updates atomically', async () => {
    const storage = await makeStorage();

    const a = await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });
    await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: {
        ...input,
        externalSource: { ...input.externalSource, externalId: '43' },
        title: 'Second',
      },
    });

    const listed = await storage.list({ orgId: 'org1', factoryProjectId: 'p1' });
    expect(listed).toHaveLength(2);
    expect(await storage.list({ orgId: 'org2', factoryProjectId: 'p1' })).toHaveLength(0);

    const updated = await storage.update({
      orgId: 'org1',
      id: a.item.id,
      userId: 'mover',
      patch: { stages: ['build'] },
    });
    expect(updated?.item.stages).toEqual(['build']);
    expect(updated?.previous.stages).toEqual(['intake']);
    expect(updated?.item.stageHistory).toEqual([
      expect.objectContaining({ stage: 'intake', by: 'u', exitedAt: expect.any(String) }),
      expect.objectContaining({ stage: 'build', by: 'mover', enteredAt: expect.any(String) }),
    ]);

    const deleted = await storage.delete({ orgId: 'org1', id: a.item.id });
    expect(deleted?.id).toBe(a.item.id);
    expect(await storage.delete({ orgId: 'org1', id: a.item.id })).toBeNull();
  });

  it('serves the board poll from the list cache without cloning, and keeps it safe from mutating callers', async () => {
    const storage = await makeStorage();
    await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });

    const first = await storage.listShared({ orgId: 'org1', factoryProjectId: 'p1' });
    const second = await storage.listShared({ orgId: 'org1', factoryProjectId: 'p1' });
    expect(second).toBe(first);
    expect(second[0]).toBe(first[0]);

    const owned = await storage.list({ orgId: 'org1', factoryProjectId: 'p1' });
    expect(owned[0]).not.toBe(first[0]);
    owned[0]!.title = 'Mutated by a caller';
    owned[0]!.stages.push('build');
    const shared = await storage.listShared({ orgId: 'org1', factoryProjectId: 'p1' });
    expect(shared[0]?.title).toBe('Fix login');
    expect(shared[0]?.stages).toEqual(['intake']);
  });

  it('holds list order when a later write touches an older card', async () => {
    const storage = await makeStorage();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'));
      const older = await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });
      vi.setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
      const newer = await storage.upsert({
        orgId: 'org1',
        userId: 'u',
        factoryProjectId: 'p1',
        input: { ...input, externalSource: { ...input.externalSource, externalId: '43' } },
      });
      vi.setSystemTime(new Date('2026-08-03T00:00:00.000Z'));
      await storage.update({ orgId: 'org1', id: older.item.id, userId: 'u', patch: { title: 'Touched' } });

      const listed = await storage.list({ orgId: 'org1', factoryProjectId: 'p1' });
      expect(listed.map(item => item.id)).toEqual([newer.item.id, older.item.id]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('validates parent relationships within a project and prevents cycles', async () => {
    const storage = await makeStorage();
    const parent = await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });
    const child = await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: {
        ...input,
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '42' },
        parentWorkItemId: parent.item.id,
      },
    });

    expect(child.item.parentWorkItemId).toBe(parent.item.id);
    await expect(
      storage.update({
        orgId: 'org1',
        id: parent.item.id,
        userId: 'u',
        patch: { parentWorkItemId: child.item.id },
      }),
    ).rejects.toBeInstanceOf(WorkItemRelationError);
    await expect(
      storage.upsert({
        orgId: 'org1',
        userId: 'u',
        factoryProjectId: 'p2',
        input: {
          ...input,
          externalSource: { integrationId: 'github', type: 'pull-request', externalId: '43' },
          parentWorkItemId: parent.item.id,
        },
      }),
    ).rejects.toBeInstanceOf(WorkItemRelationError);
  });

  it('fills a missing parent relationship without replacing an existing one', async () => {
    const storage = await makeStorage();
    const firstParent = await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });
    const secondParent = await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: { ...input, externalSource: { integrationId: 'github', type: 'issue', externalId: '43' } },
    });
    const child = await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: {
        ...input,
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '44' },
      },
    });

    const linked = await storage.setParentWorkItemIfMissing({
      orgId: 'org1',
      id: child.item.id,
      userId: 'u',
      parentWorkItemId: firstParent.item.id,
    });
    const preserved = await storage.setParentWorkItemIfMissing({
      orgId: 'org1',
      id: child.item.id,
      userId: 'u',
      parentWorkItemId: secondParent.item.id,
    });

    expect(linked?.parentWorkItemId).toBe(firstParent.item.id);
    expect(preserved?.parentWorkItemId).toBe(firstParent.item.id);
  });

  it('clears child relationships when deleting a parent', async () => {
    const storage = await makeStorage();
    const parent = await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });
    const child = await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: {
        ...input,
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '42' },
        parentWorkItemId: parent.item.id,
      },
    });

    await storage.delete({ orgId: 'org1', id: parent.item.id });

    const items = await storage.list({ orgId: 'org1', factoryProjectId: 'p1' });
    expect(items.find(item => item.id === child.item.id)?.parentWorkItemId).toBeNull();
  });

  it('serializes child creation with parent deletion when distributed locking is unavailable', async () => {
    const backend = new LibSQLFactoryStorage({ id: 'work-items-create-delete-lock-test', url: ':memory:' });
    const storage = backend.registerDomain(new WorkItemsStorage());
    await backend.init();
    const parent = await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });
    const childInsertReached = deferred();
    const releaseChildInsert = deferred();
    const deleteMany = vi.fn();
    interceptTransactionOps(backend, ops => ({
      insertOne: async (collection: string, record: any) => {
        if (collection === 'work_items' && record.parent_work_item_id === parent.item.id) {
          childInsertReached.resolve();
          await releaseChildInsert.promise;
        }
        return ops.insertOne(collection, record);
      },
      deleteMany: (collection: string, where: any) => {
        if (collection === 'work_items') deleteMany(collection, where);
        return ops.deleteMany(collection, where);
      },
    }));

    const childPromise = storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: {
        ...input,
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '42' },
        parentWorkItemId: parent.item.id,
      },
    });
    await childInsertReached.promise;
    const deletion = storage.delete({ orgId: 'org1', id: parent.item.id });
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    expect(deleteMany).not.toHaveBeenCalled();
    releaseChildInsert.resolve();
    const [child] = await Promise.all([childPromise, deletion]);
    expect((await storage.get({ orgId: 'org1', id: child.item.id }))?.parentWorkItemId).toBeNull();
  });

  it('serializes reparenting with parent deletion when distributed locking is unavailable', async () => {
    const backend = new LibSQLFactoryStorage({ id: 'work-items-reparent-delete-lock-test', url: ':memory:' });
    const storage = backend.registerDomain(new WorkItemsStorage());
    await backend.init();
    const parent = await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });
    const child = await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: {
        ...input,
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '42' },
      },
    });
    const childUpdateReached = deferred();
    const releaseChildUpdate = deferred();
    const deleteMany = vi.fn();
    interceptTransactionOps(backend, ops => ({
      updateAtomic: async (collection: string, where: any, updater: any) => {
        if (collection === 'work_items' && where.id === child.item.id) {
          childUpdateReached.resolve();
          await releaseChildUpdate.promise;
        }
        return ops.updateAtomic(collection, where, updater);
      },
      deleteMany: (collection: string, where: any) => {
        if (collection === 'work_items') deleteMany(collection, where);
        return ops.deleteMany(collection, where);
      },
    }));

    const reparenting = storage.update({
      orgId: 'org1',
      id: child.item.id,
      userId: 'u',
      patch: { parentWorkItemId: parent.item.id },
    });
    await childUpdateReached.promise;
    const deletion = storage.delete({ orgId: 'org1', id: parent.item.id });
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    expect(deleteMany).not.toHaveBeenCalled();
    releaseChildUpdate.resolve();
    await Promise.all([reparenting, deletion]);
    expect((await storage.get({ orgId: 'org1', id: child.item.id }))?.parentWorkItemId).toBeNull();
  });

  it('never supersedes failed decisions at boot until the host says which phases are terminal', async () => {
    const storage = await makeStorage();
    const scope = { orgId: 'org1', factoryProjectId: 'p1' };
    const created = await storage.upsert({ ...scope, userId: 'u', input: { ...input, stages: ['done'] } });
    const now = new Date('2030-01-01T00:00:00.000Z');
    await storage.commitRuleEvaluation({
      ...scope,
      workItemId: created.item.id,
      ingress: { identity: 'legacy-1', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: created.item.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'invokeSkill', role: 'work', skillName: 'factory-plan', idempotencyKey: 'legacy-1' }],
      causalChain: [],
      now,
    });
    const [claimed] = await storage.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    if (!claimed) throw new Error('Expected a claimable decision');
    await storage.failDeferredDecision({
      ...scope,
      id: claimed.id,
      ownerId: 'worker-1',
      now,
      availableAt: now,
      lastError: 'boom',
      failureCode: 'session_unavailable',
      terminal: true,
    });

    await storage.repairLegacyAttentionState();
    expect((await storage.listDeferredDecisions('org1', 'p1'))[0]?.status).toBe('failed');

    storage.useTerminalPhasePredicate(item => item.stages[0] === 'done');
    await storage.repairLegacyAttentionState();
    expect((await storage.listDeferredDecisions('org1', 'p1'))[0]?.status).toBe('superseded');
  });

  it('pages each status on its own newest-first keyset', async () => {
    const storage = await makeStorage();
    const scope = { orgId: 'org1', factoryProjectId: 'p1' };
    const created = await storage.upsert({ ...scope, userId: 'u', input });
    const parkedIds: string[] = [];
    for (const [index, at] of ['2030-01-01T00:00:00.000Z', '2030-01-01T00:05:00.000Z'].entries()) {
      const now = new Date(at);
      const current = await storage.get({ orgId: 'org1', id: created.item.id });
      await storage.commitRuleEvaluation({
        ...scope,
        workItemId: created.item.id,
        ingress: { identity: `park-${index}`, triggerType: 'test' },
        configVersion: 'rules-v1',
        expectedRevision: current?.revision ?? created.item.revision,
        actor: { type: 'system', id: 'rules' },
        outcome: { status: 'accepted' },
        decisions: [
          { type: 'invokeSkill', role: 'triage', skillName: 'factory-triage', idempotencyKey: `park-${index}` },
        ],
        causalChain: [],
        now,
      });
      const [claimed] = await storage.claimDeferredDecisions({
        ownerId: 'worker-1',
        now,
        leaseExpiresAt: new Date(now.getTime() + 30_000),
        limit: 1,
      });
      if (!claimed) throw new Error('Expected a claimable decision');
      const proposed = await storage.proposeDeferredDecision({ ...scope, id: claimed.id, ownerId: 'worker-1' }, now);
      if (!proposed) throw new Error('Expected a proposed decision');
      parkedIds.push(proposed.id);
    }

    const page = await storage.listDecisionPageByStatus({ ...scope, status: 'proposed', limit: 1 });
    expect(page).toMatchObject({ hasMore: true });
    expect(page.decisions.map(decision => decision.id)).toEqual([parkedIds[1]]);

    const next = await storage.listDecisionPageByStatus({
      ...scope,
      status: 'proposed',
      before: { occurredAt: page.decisions[0]!.updatedAt, id: page.decisions[0]!.id },
      limit: 5,
    });
    expect(next.decisions.map(decision => decision.id)).toEqual([parkedIds[0]]);
    await expect(storage.listDecisionPageByStatus({ ...scope, status: 'failed', limit: 5 })).resolves.toMatchObject({
      decisions: [],
      hasMore: false,
    });
  });

  it('treats a concurrently deleted attention receipt as stale', async () => {
    const backend = new LibSQLFactoryStorage({ id: 'attention-receipt-race-test', url: ':memory:' });
    const storage = backend.registerDomain(new WorkItemsStorage());
    await backend.init();
    const scope = { orgId: 'org1', factoryProjectId: 'p1' };
    const created = await storage.upsert({ ...scope, userId: 'u', input });
    const now = new Date('2030-01-01T00:00:00.000Z');
    await storage.commitRuleEvaluation({
      ...scope,
      workItemId: created.item.id,
      ingress: { identity: 'receipt-race', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: created.item.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Notify the session.',
          idempotencyKey: 'receipt-race',
        },
      ],
      causalChain: [],
      now,
    });
    const [claimed] = await storage.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    if (!claimed) throw new Error('Expected a deferred decision');
    const failed = await storage.failDeferredDecision({
      id: claimed.id,
      orgId: claimed.orgId,
      factoryProjectId: claimed.factoryProjectId,
      ownerId: 'worker-1',
      now,
      availableAt: now,
      lastError: 'Session unavailable.',
      failureCode: 'session_unavailable',
      terminal: true,
    });
    if (!failed) throw new Error('Expected a failed decision');
    await storage.setAttentionReceipt({
      ...scope,
      userId: 'u',
      identity: factoryDecisionAttentionIdentity(failed.id, failed.failureOccurrence),
      action: 'read',
      now,
    });
    interceptTransactionOps(backend, ops => ({
      updateAtomic: (collection: string, where: unknown, updater: unknown) =>
        collection === 'factory_attention_receipts' ? null : ops.updateAtomic(collection, where, updater),
    }));

    await expect(
      storage.setAttentionReceipt({
        ...scope,
        userId: 'u',
        identity: factoryDecisionAttentionIdentity(failed.id, failed.failureOccurrence),
        action: 'archive',
        now,
      }),
    ).resolves.toBeNull();
  });

  it('uses serializable transactions for relationship writes and deletion', async () => {
    const backend = new LibSQLFactoryStorage({ id: 'work-items-relation-test', url: ':memory:' });
    const withTransaction = vi.spyOn(backend, 'withTransaction');
    const storage = backend.registerDomain(new WorkItemsStorage());
    await backend.init();

    const parent = await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });
    const child = await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: {
        ...input,
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '42' },
        parentWorkItemId: parent.item.id,
      },
    });
    await storage.update({ orgId: 'org1', id: child.item.id, userId: 'u', patch: { parentWorkItemId: null } });
    await storage.delete({ orgId: 'org1', id: parent.item.id });

    expect(withTransaction.mock.calls.map(([, options]) => options)).toEqual([
      { isolationLevel: 'serializable' },
      { isolationLevel: 'serializable' },
      { isolationLevel: 'serializable' },
    ]);
  });

  it('stamps the actor in both `by` and `exitedBy` when a stage move closes an entry', async () => {
    const storage = await makeStorage();
    const created = await storage.upsert({ orgId: 'org1', userId: 'creator', factoryProjectId: 'p1', input });

    const updated = await storage.update({
      orgId: 'org1',
      id: created.item.id,
      userId: 'mover',
      patch: { stages: ['triage'] },
    });

    const history = updated!.item.stageHistory;
    const closed = history.find(entry => entry.stage === 'intake')!;
    const opened = history.find(entry => entry.stage === 'triage')!;
    expect(closed.exitedAt).toBeDefined();
    expect(closed.exitedBy).toBe('mover');
    expect(closed.by).toBe('creator');
    expect(opened.by).toBe('mover');
    expect(opened.exitedAt).toBeUndefined();
    expect(opened.exitedBy).toBeUndefined();
  });
});

describe('work item subscriptions', () => {
  const follow = (workItemId: string, sessionId: string, reason: 'created' | 'started' | 'subscribed') => ({
    orgId: 'org1',
    factoryProjectId: 'project1',
    workItemId,
    sessionId,
    threadId: `${sessionId}-thread`,
    resourceId: sessionId,
    userId: 'user1',
    reason,
  });

  async function seed() {
    const storage = await makeStorage();
    const { item } = await storage.upsert({ orgId: 'org1', userId: 'user1', factoryProjectId: 'project1', input });
    const { item: other } = await storage.upsert({
      orgId: 'org1',
      userId: 'user1',
      factoryProjectId: 'project1',
      input: { ...input, externalSource: { ...input.externalSource, externalId: '43' } },
    });
    return { storage, item, other };
  }

  it('is idempotent and keeps the earliest reason', async () => {
    const { storage, item } = await seed();
    const first = await storage.subscribeToWorkItem(follow(item.id, 'sess-a', 'created'));
    const again = await storage.subscribeToWorkItem(follow(item.id, 'sess-a', 'subscribed'));

    expect(again).toEqual(first);
    expect(first).toMatchObject({
      workItemId: item.id,
      sessionId: 'sess-a',
      threadId: 'sess-a-thread',
      reason: 'created',
    });
    expect(await storage.listWorkItemSubscribers({ orgId: 'org1', workItemId: item.id })).toHaveLength(1);
  });

  it("lists an item's subscribers and a session's subscriptions, scoped by org and Factory", async () => {
    const { storage, item, other } = await seed();
    // Distinct timestamps, so "earliest first" doesn't fall to the random-id tiebreak.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-14T10:00:00Z') });
    try {
      await storage.subscribeToWorkItem(follow(item.id, 'sess-a', 'created'));
      vi.setSystemTime(new Date('2026-10-14T10:00:01Z'));
      await storage.subscribeToWorkItem(follow(item.id, 'sess-b', 'subscribed'));
      vi.setSystemTime(new Date('2026-10-14T10:00:02Z'));
      await storage.subscribeToWorkItem(follow(other.id, 'sess-a', 'started'));
    } finally {
      vi.useRealTimers();
    }

    const subscribers = await storage.listWorkItemSubscribers({ orgId: 'org1', workItemId: item.id });
    expect(subscribers.map(row => [row.sessionId, row.reason])).toEqual([
      ['sess-a', 'created'],
      ['sess-b', 'subscribed'],
    ]);
    const followed = await storage.listSessionSubscriptions({
      orgId: 'org1',
      factoryProjectId: 'project1',
      sessionId: 'sess-a',
    });
    expect(followed.map(row => row.workItemId).sort()).toEqual([item.id, other.id].sort());
    expect(await storage.listWorkItemSubscribers({ orgId: 'org2', workItemId: item.id })).toEqual([]);
    expect(
      await storage.listSessionSubscriptions({ orgId: 'org1', factoryProjectId: 'project2', sessionId: 'sess-a' }),
    ).toEqual([]);
  });

  it('unsubscribes one session from one item', async () => {
    const { storage, item, other } = await seed();
    await storage.subscribeToWorkItem(follow(item.id, 'sess-a', 'subscribed'));
    await storage.subscribeToWorkItem(follow(other.id, 'sess-a', 'subscribed'));

    expect(await storage.unsubscribeFromWorkItem({ orgId: 'org1', workItemId: item.id, sessionId: 'sess-a' })).toBe(
      true,
    );
    expect(await storage.unsubscribeFromWorkItem({ orgId: 'org1', workItemId: item.id, sessionId: 'sess-a' })).toBe(
      false,
    );
    expect(await storage.listWorkItemSubscribers({ orgId: 'org1', workItemId: item.id })).toEqual([]);
    expect(await storage.listWorkItemSubscribers({ orgId: 'org1', workItemId: other.id })).toHaveLength(1);
  });

  it("removes an item's subscriptions when the item is deleted", async () => {
    const { storage, item, other } = await seed();
    await storage.subscribeToWorkItem(follow(item.id, 'sess-a', 'created'));
    await storage.subscribeToWorkItem(follow(other.id, 'sess-a', 'created'));

    await storage.delete({ orgId: 'org1', id: item.id });

    expect(await storage.listWorkItemSubscribers({ orgId: 'org1', workItemId: item.id })).toEqual([]);
    const followed = await storage.listSessionSubscriptions({
      orgId: 'org1',
      factoryProjectId: 'project1',
      sessionId: 'sess-a',
    });
    expect(followed.map(row => row.workItemId)).toEqual([other.id]);
  });
});

describe('applyStageTransition', () => {
  it('stamps exitedBy alongside exitedAt when closing an exited stage', () => {
    const history: WorkItemStageEntry[] = [{ stage: 'intake', enteredAt: '2026-07-01T00:00:00.000Z', by: 'user_1' }];

    const next = applyStageTransition(history, ['intake'], ['triage'], 'user_2', new Date('2026-07-02T00:00:00.000Z'));

    expect(next[0]).toEqual({
      stage: 'intake',
      enteredAt: '2026-07-01T00:00:00.000Z',
      by: 'user_1',
      exitedAt: '2026-07-02T00:00:00.000Z',
      exitedBy: 'user_2',
    });
    expect(next[1]).toEqual({ stage: 'triage', enteredAt: '2026-07-02T00:00:00.000Z', by: 'user_2' });
  });

  it('leaves entries closed before exit stamping existed (no exitedBy) untouched', () => {
    const legacy: WorkItemStageEntry[] = [
      { stage: 'intake', enteredAt: '2026-06-01T00:00:00.000Z', exitedAt: '2026-06-02T00:00:00.000Z', by: 'user_1' },
      { stage: 'triage', enteredAt: '2026-06-02T00:00:00.000Z', by: 'user_1' },
    ];

    const next = applyStageTransition(legacy, ['triage'], ['planning'], 'user_2', new Date('2026-07-01T00:00:00.000Z'));

    expect(next[0]).toEqual(legacy[0]); // no retroactive exitedBy
    expect(next[0]!.exitedBy).toBeUndefined();
    expect(next[1]!.exitedBy).toBe('user_2');
  });
});

describe('isAgentActor', () => {
  it.each([
    ['agent:binding-1', true],
    ['factory-tool-result-rule', true],
    // The poller's actors: a machine moved the card, but no agent worked it.
    ['factory-rule-dispatcher', false],
    ['github:someone', false],
    ['factory', false],
    ['system', false],
    ['user_wos_123', false],
    ['', false],
    [undefined, false],
  ] as const)('isAgentActor(%j) → %s', (actor, expected) => {
    expect(isAgentActor(actor)).toBe(expected);
  });
});

describe('getBySource', () => {
  const slackThread = { integrationId: 'slack', type: 'slack-thread', externalId: 'slack:C-1:1700.42' };

  it('resolves the card a platform thread created without knowing its tenant', async () => {
    const storage = await makeStorage();
    const created = await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: { ...input, externalSource: slackThread },
    });

    expect((await storage.getBySource(slackThread))?.id).toBe(created.item.id);
  });

  it('resolves to nothing for a source no card was born from', async () => {
    const storage = await makeStorage();
    await storage.upsert({ orgId: 'org1', userId: 'u', factoryProjectId: 'p1', input });

    expect(await storage.getBySource(slackThread)).toBeNull();
  });

  it('keeps two workspaces that issued the same thread id apart', async () => {
    const storage = await makeStorage();
    const theirs = { ...slackThread, workspaceId: 'T-them' };
    const ours = { ...slackThread, workspaceId: 'T-us' };
    await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      factoryProjectId: 'p1',
      input: { ...input, externalSource: theirs },
    });
    const mine = await storage.upsert({
      orgId: 'org2',
      userId: 'u',
      factoryProjectId: 'p2',
      input: { ...input, externalSource: ours },
    });

    expect((await storage.getBySource(ours))?.id).toBe(mine.item.id);
  });

  it('resolves canonical sources within the requested organization and project', async () => {
    const storage = await makeStorage();
    for (const orgId of ['org1', 'org2']) {
      for (const factoryProjectId of orgId === 'org1' ? ['p1', 'p2'] : ['p3', 'p4']) {
        const created = await storage.upsert({
          orgId,
          userId: 'u',
          factoryProjectId,
          input: { ...input, externalSource: slackThread },
        });
        expect(await storage.getByProjectSource({ orgId, factoryProjectId, source: slackThread })).toEqual(
          created.item,
        );
      }
    }
    const found = await storage.getByProjectSource({ orgId: 'org1', factoryProjectId: 'p1', source: slackThread });
    expect(found).toMatchObject({ orgId: 'org1', factoryProjectId: 'p1' });
    expect(
      await storage.getByProjectSource({ orgId: 'org1', factoryProjectId: 'missing', source: slackThread }),
    ).toBeNull();
    expect(
      await storage.getByProjectSource({ orgId: 'missing', factoryProjectId: 'p1', source: slackThread }),
    ).toBeNull();
    expect(
      await storage.getByProjectSource({
        orgId: 'org1',
        factoryProjectId: 'p1',
        source: { ...slackThread, integrationId: 'other' },
      }),
    ).toBeNull();
  });

  it('refuses to guess when two projects hold the same source', async () => {
    const storage = await makeStorage();
    for (const factoryProjectId of ['p1', 'p2']) {
      await storage.upsert({
        orgId: 'org1',
        userId: 'u',
        factoryProjectId,
        input: { ...input, externalSource: slackThread },
      });
    }

    expect(await storage.getBySource(slackThread)).toBeNull();
  });
});

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'one card per external record per project on %s',
  backend => {
    const record = {
      externalSource: { integrationId: 'jira', type: 'issue', externalId: 'jira-issue:conn-1:ENG-42:10001' },
      title: 'Fix intake sync',
      stages: ['intake'],
      sessions: {},
      metadata: {},
    };

    async function setup() {
      const storage =
        backend === 'postgres'
          ? new PgFactoryStorage({ id: `work-items-${randomUUID()}`, connectionString: postgresUrl! })
          : new LibSQLFactoryStorage({ id: `work-items-${randomUUID()}`, url: ':memory:' });
      const workItems = storage.registerDomain(new WorkItemsStorage());
      await storage.init();
      onTestFinished(() => storage.close());
      workItems.useTerminalPhasePredicate(item => item.stages.includes('done'));
      const orgId = `org-${randomUUID()}`;
      // Postgres persists across runs and the source-key index is per project id, so ids are unique per test.
      const project = (name: string) => `${name}-${orgId}`;
      const upsert = (name: string) =>
        workItems.upsert({
          orgId,
          userId: 'user-1',
          factoryProjectId: project(name),
          input: record,
          reuseMode: 'preserve',
        });
      const start = (name: string) =>
        workItems.prepareRunStart({
          orgId,
          userId: 'user-1',
          factoryProjectId: project(name),
          workItem: { input: record },
          role: 'work',
          session: {
            sessionId: `session-${project(name)}`,
            branch: 'factory/eng-42',
            threadId: `thread-${project(name)}`,
          },
          resourceId: 'resource-1',
          kickoffKey: `kickoff-${project(name)}`,
          kickoffMessage: null,
        });
      const cards = async (name: string) =>
        (await workItems.list({ orgId, factoryProjectId: project(name) })).filter(
          item => item.externalSource?.externalId === record.externalSource.externalId,
        );
      return { storage, workItems, orgId, upsert, start, cards };
    }

    it('files the same external record in two projects', async () => {
      const { upsert, start, cards } = await setup();

      const a = await upsert('project-a');
      const b = await upsert('project-b');
      expect(a.created).toBe(true);
      expect(b.created).toBe(true);
      expect(b.item.id).not.toBe(a.item.id);

      const c = await start('project-c');
      const d = await start('project-d');
      expect(d.item.id).not.toBe(c.item.id);

      for (const project of ['project-a', 'project-b', 'project-c', 'project-d']) {
        expect(await cards(project)).toHaveLength(1);
      }
    });

    it("reuses a project's card for the same record, also after it finished", async () => {
      const { workItems, orgId, upsert, cards } = await setup();

      const first = await upsert('project-a');
      const live = await upsert('project-a');
      expect(live).toMatchObject({ created: false, item: { id: first.item.id } });

      await workItems.update({ orgId, userId: 'user-1', id: first.item.id, patch: { stages: ['done'] } });
      const finished = await upsert('project-a');
      expect(finished).toMatchObject({ created: false, item: { id: first.item.id, stages: ['done'] } });
      expect(await cards('project-a')).toHaveLength(1);
    });

    it('a claim left on an old card blocks nothing', async () => {
      const { storage, upsert, cards } = await setup();

      const a = await upsert('project-a');
      // A card filed while claims were enforced still carries its claim value.
      await storage.ops.updateMany('work_items', { id: a.item.id }, { claim_key: 'jira:issue:X' });

      const b = await upsert('project-b');
      expect(b.created).toBe(true);
      const again = await upsert('project-a');
      expect(again).toMatchObject({ created: false, item: { id: a.item.id } });
      expect(await cards('project-a')).toHaveLength(1);
      expect(await cards('project-b')).toHaveLength(1);

      const rowA = await storage.ops.findOne<{ claim_key: string | null }>('work_items', { id: a.item.id });
      const rowB = await storage.ops.findOne<{ claim_key: string | null }>('work_items', { id: b.item.id });
      expect(rowA?.claim_key).toBe('jira:issue:X');
      expect(rowB?.claim_key).toBeNull();
    });
  },
);
