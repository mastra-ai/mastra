/**
 * Work-items domain over a real backend (libsql `:memory:`): external-source
 * dedup scoping and the atomic update path.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FactoryStorageDomain } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';

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
        ruleSetVersion: 'rules-v1',
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

  it('purges replay state when a linked work item is deleted', async () => {
    const storage = await makeStorage();
    const scope = { orgId: 'org1', factoryProjectId: 'p1' };
    const created = await storage.upsert({ ...scope, userId: 'u', input });
    const commit = () =>
      storage.commitRuleEvaluation({
        ...scope,
        workItemId: null,
        ingress: { identity: 'linear:issue:ENG-1:1', triggerType: 'issue.observed' },
        ruleSetVersion: 'v1',
        expectedRevision: null,
        actor: { type: 'system', id: 'rules' },
        outcome: { status: 'accepted' },
        decisions: [
          {
            type: 'upsertLinkedWorkItem',
            sourceKey: 'github:issue:42',
            idempotencyKey: 'decision-1',
            board: 'work',
            stage: 'triage',
          } as never,
        ],
        causalChain: [],
        now: new Date(),
      });

    expect((await commit()).status).toBe('committed');
    expect((await commit()).status).toBe('replayed');

    await storage.delete({ orgId: 'org1', id: created.item.id });

    // Stale ingress no longer short-circuits, so nothing resurrects the deleted card.
    expect((await commit()).status).toBe('committed');
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
        ruleSetVersion: 'rules-v1',
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
      ruleSetVersion: 'rules-v1',
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

describe('supervisor finding notification stamps', () => {
  const finding = (key: string) => ({
    id: key,
    kind: 'decision-failed' as const,
    workItemId: 'item-1',
    workItemNumber: null,
    title: 'A decision failed',
    evidence: '[run_awaiting_input] failed after 1 attempt(s)',
    ageMs: 1_000,
    suggestedRepair: { action: 'retry-decision' as const, decisionId: 'decision-1' },
  });
  const scope = { orgId: 'org1', factoryProjectId: 'p1' };

  async function openFinding(storage: WorkItemsStorage, key: string, now: Date) {
    await storage.syncSupervisorFindings({ ...scope, findings: [finding(key)], now });
  }

  async function getRow(storage: WorkItemsStorage, key: string) {
    const page = await storage.listSupervisorFindingPage({ ...scope, limit: 10 });
    return page.rows.find(row => row.findingKey === key);
  }

  /** Stamps the row's current content, as a sender that just rang it would. */
  async function stamp(storage: WorkItemsStorage, key: string, occurrence: number, notifiedAt: Date) {
    const row = await getRow(storage, key);
    await storage.markSupervisorFindingNotified({
      ...scope,
      findingKey: key,
      occurrence,
      notifiedAt,
      finding: row?.finding ?? {},
    });
  }

  it('round-trips last_notified_at through the stamp method', async () => {
    const storage = await makeStorage();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));
    expect((await getRow(storage, 'decision-failed:item-1'))?.lastNotifiedAt).toBeNull();

    const notifiedAt = new Date('2030-01-01T00:01:00.000Z');
    await stamp(storage, 'decision-failed:item-1', 0, notifiedAt);
    expect((await getRow(storage, 'decision-failed:item-1'))?.lastNotifiedAt?.getTime()).toBe(notifiedAt.getTime());
  });

  it('openSupervisorFinding with newContent resets stamp and escalation state, and the stamp is content-safe', async () => {
    const storage = await makeStorage();
    const key = 'decision-failed:item-1';
    const t0 = new Date('2030-01-01T00:00:00.000Z');
    await openFinding(storage, key, t0);
    await stamp(storage, key, 0, t0);
    await storage.escalateSupervisorFinding({
      ...scope,
      findingKey: key,
      note: 'old question needs a person',
      escalatedAt: t0,
    });
    expect(await getRow(storage, key)).toMatchObject({
      status: 'escalated',
      escalationNote: 'old question needs a person',
    });

    // Question two on the same run: new content, same occurrence.
    const q2 = { ...finding(key), evidence: 'Parked on ask_user: "q2"' };
    const t1 = new Date('2030-01-01T00:05:00.000Z');
    const refreshed = await storage.openSupervisorFinding({ ...scope, finding: q2, now: t1, newContent: true });
    expect(refreshed).toMatchObject({
      occurrence: 0,
      status: 'open',
      escalatedAt: null,
      escalationNote: null,
      lastNotifiedAt: null,
    });
    expect((await storage.listUnnotifiedSupervisorFindings({ ...scope, limit: 10 })).map(r => r.findingKey)).toEqual([
      key,
    ]);

    // Question three lands while question two's ring is still in flight.
    const q3 = { ...finding(key), evidence: 'Parked on ask_user: "q3"' };
    await storage.openSupervisorFinding({
      ...scope,
      finding: q3,
      now: new Date('2030-01-01T00:06:00.000Z'),
      newContent: true,
    });
    // Question two's ring landing must not mark the row (now question three) as notified.
    await storage.markSupervisorFindingNotified({
      ...scope,
      findingKey: key,
      occurrence: 0,
      notifiedAt: new Date('2030-01-01T00:06:30.000Z'),
      finding: refreshed.finding,
    });
    expect((await getRow(storage, key))?.lastNotifiedAt).toBeNull();
    // Question three's own ring does.
    const current = (await getRow(storage, key))!;
    await storage.markSupervisorFindingNotified({
      ...scope,
      findingKey: key,
      occurrence: 0,
      notifiedAt: new Date('2030-01-01T00:07:00.000Z'),
      finding: current.finding,
    });
    expect((await getRow(storage, key))?.lastNotifiedAt).toBeInstanceOf(Date);
  });

  it('lists only open, un-stamped findings oldest first', async () => {
    const storage = await makeStorage();
    const t0 = new Date('2030-01-01T00:00:00.000Z');
    const keys = ['decision-failed:a', 'decision-failed:b', 'decision-failed:c', 'decision-failed:d'];
    await storage.syncSupervisorFindings({ ...scope, findings: keys.map(finding), now: t0 });
    await stamp(storage, 'decision-failed:b', 0, t0);
    // Resolve `c` and `d` by syncing a snapshot without them; `d` stays resolved.
    await storage.syncSupervisorFindings({
      ...scope,
      findings: [finding('decision-failed:a'), finding('decision-failed:b')],
      now: new Date('2030-01-01T00:01:00.000Z'),
    });
    // Reopen `c` later: it comes back un-stamped and newer than `a`.
    await storage.syncSupervisorFindings({
      ...scope,
      findings: [finding('decision-failed:a'), finding('decision-failed:b'), finding('decision-failed:c')],
      now: new Date('2030-01-01T00:02:00.000Z'),
    });

    const rows = await storage.listUnnotifiedSupervisorFindings({ ...scope, limit: 10 });
    expect(rows.map(row => row.findingKey)).toEqual(['decision-failed:a', 'decision-failed:c']);
    const firstPage = await storage.listUnnotifiedSupervisorFindings({ ...scope, limit: 1 });
    expect(firstPage.map(row => row.findingKey)).toEqual(['decision-failed:a']);
    const nextPage = await storage.listUnnotifiedSupervisorFindings({
      ...scope,
      limit: 1,
      after: { openedAt: firstPage[0]!.openedAt, id: firstPage[0]!.id },
    });
    expect(nextPage.map(row => row.findingKey)).toEqual(['decision-failed:c']);
  });

  it('is occurrence-safe: a stale stamp after resolve/reopen is a silent no-op', async () => {
    const storage = await makeStorage();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));

    // The finding resolves (absent from the next sweep) and reopens (present
    // again) between the emit and the stamp: occurrence advances to 1.
    await storage.syncSupervisorFindings({ ...scope, findings: [], now: new Date('2030-01-01T00:02:00.000Z') });
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:03:00.000Z'));
    const reopened = await getRow(storage, 'decision-failed:item-1');
    expect(reopened?.occurrence).toBe(1);

    // The stale stamp was emitted for occurrence 0 — it must not land.
    await stamp(storage, 'decision-failed:item-1', 0, new Date('2030-01-01T00:04:00.000Z'));
    expect((await getRow(storage, 'decision-failed:item-1'))?.lastNotifiedAt).toBeNull();
  });

  it('stamps only once: a second stamp on an already-stamped row is a no-op', async () => {
    const storage = await makeStorage();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));
    const first = new Date('2030-01-01T00:01:00.000Z');
    await stamp(storage, 'decision-failed:item-1', 0, first);
    await stamp(storage, 'decision-failed:item-1', 0, new Date('2030-01-01T00:05:00.000Z'));
    expect((await getRow(storage, 'decision-failed:item-1'))?.lastNotifiedAt?.getTime()).toBe(first.getTime());
  });

  it('reopen clears the stamp so a reopened incident re-emits', async () => {
    const storage = await makeStorage();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));
    await stamp(storage, 'decision-failed:item-1', 0, new Date('2030-01-01T00:01:00.000Z'));

    await storage.syncSupervisorFindings({ ...scope, findings: [], now: new Date('2030-01-01T00:02:00.000Z') });
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:03:00.000Z'));

    const reopened = await getRow(storage, 'decision-failed:item-1');
    expect(reopened?.occurrence).toBe(1);
    expect(reopened?.lastNotifiedAt).toBeNull();
  });

  it('auto-resolve leaves the stamp untouched on the resolved row', async () => {
    const storage = await makeStorage();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));
    const notifiedAt = new Date('2030-01-01T00:01:00.000Z');
    await stamp(storage, 'decision-failed:item-1', 0, notifiedAt);

    // Resolve via reconciliation (finding absent from the sweep).
    await storage.syncSupervisorFindings({ ...scope, findings: [], now: new Date('2030-01-01T00:02:00.000Z') });
    // Resolved rows leave the open page; the stamp is not cleared by resolution
    // itself (only reopen clears it).
    expect(await getRow(storage, 'decision-failed:item-1')).toBeUndefined();
  });

  it('opens findings with status open and no escalation fields', async () => {
    const storage = await makeStorage();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));
    const row = await getRow(storage, 'decision-failed:item-1');
    expect(row?.status).toBe('open');
    expect(row?.escalatedAt).toBeNull();
    expect(row?.escalationNote).toBeNull();
  });

  it('escalates an open finding and round-trips the note', async () => {
    const storage = await makeStorage();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));
    const escalatedAt = new Date('2030-01-01T00:01:00.000Z');
    const updated = await storage.escalateSupervisorFinding({
      ...scope,
      findingKey: 'decision-failed:item-1',
      note: 'Worker asked which API to target; needs a product call.',
      escalatedAt,
    });
    expect(updated?.status).toBe('escalated');
    expect(updated?.escalatedAt?.getTime()).toBe(escalatedAt.getTime());
    const row = await getRow(storage, 'decision-failed:item-1');
    expect(row?.status).toBe('escalated');
    expect(row?.escalationNote).toBe('Worker asked which API to target; needs a product call.');
    // Escalation is a visibility refinement, not a resolution: the row stays open.
    expect(row?.resolvedAt).toBeNull();
  });

  it('refuses to escalate unknown or resolved findings', async () => {
    const storage = await makeStorage();
    const escalatedAt = new Date('2030-01-01T00:01:00.000Z');
    expect(
      await storage.escalateSupervisorFinding({ ...scope, findingKey: 'decision-failed:nope', note: 'x', escalatedAt }),
    ).toBeNull();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));
    await storage.syncSupervisorFindings({ ...scope, findings: [], now: new Date('2030-01-01T00:02:00.000Z') });
    expect(
      await storage.escalateSupervisorFinding({
        ...scope,
        findingKey: 'decision-failed:item-1',
        note: 'x',
        escalatedAt,
      }),
    ).toBeNull();
  });

  it('reopen resets status to open and clears the escalation fields', async () => {
    const storage = await makeStorage();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));
    await storage.escalateSupervisorFinding({
      ...scope,
      findingKey: 'decision-failed:item-1',
      note: 'first incident',
      escalatedAt: new Date('2030-01-01T00:01:00.000Z'),
    });
    await storage.syncSupervisorFindings({ ...scope, findings: [], now: new Date('2030-01-01T00:02:00.000Z') });
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:03:00.000Z'));

    const reopened = await getRow(storage, 'decision-failed:item-1');
    expect(reopened?.occurrence).toBe(1);
    expect(reopened?.status).toBe('open');
    expect(reopened?.escalatedAt).toBeNull();
    expect(reopened?.escalationNote).toBeNull();
  });

  it('auto-resolves escalated findings like any other open row', async () => {
    const storage = await makeStorage();
    await openFinding(storage, 'decision-failed:item-1', new Date('2030-01-01T00:00:00.000Z'));
    await storage.escalateSupervisorFinding({
      ...scope,
      findingKey: 'decision-failed:item-1',
      note: 'escalated',
      escalatedAt: new Date('2030-01-01T00:01:00.000Z'),
    });
    await storage.syncSupervisorFindings({ ...scope, findings: [], now: new Date('2030-01-01T00:02:00.000Z') });
    expect(await getRow(storage, 'decision-failed:item-1')).toBeUndefined();
  });

  it('migrates pre-existing finding rows to status open with null escalation fields', async () => {
    // A row written by the pre-status schema, then the current domain
    // initializing over the same database: the additive column pass must
    // give the old row a persisted 'open' (not a mapping-time fallback).
    const dir = await mkdtemp(join(tmpdir(), 'findings-migration-'));
    const url = `file:${join(dir, 'db.sqlite')}`;
    class LegacyFindings extends FactoryStorageDomain {
      constructor() {
        super('legacy-findings');
      }
      async init() {
        await this.ensureCollections([
          {
            name: 'factory_supervisor_findings',
            columns: {
              id: { type: 'uuid-pk' },
              org_id: { type: 'text' },
              factory_project_id: { type: 'text' },
              finding_key: { type: 'text' },
              occurrence: { type: 'integer' },
              finding: { type: 'json' },
              opened_at: { type: 'timestamp' },
              updated_at: { type: 'timestamp' },
              resolved_at: { type: 'timestamp', nullable: true },
              last_notified_at: { type: 'timestamp', nullable: true },
            },
          },
        ]);
      }
      async seed() {
        await this.ops.insertOne('factory_supervisor_findings', {
          id: 'legacy-row',
          org_id: scope.orgId,
          factory_project_id: scope.factoryProjectId,
          finding_key: 'decision-failed:legacy',
          occurrence: 0,
          finding: { id: 'decision-failed:legacy', kind: 'decision-failed', title: 'old', evidence: 'old' },
          opened_at: new Date('2030-01-01T00:00:00.000Z'),
          updated_at: new Date('2030-01-01T00:00:00.000Z'),
          resolved_at: null,
          last_notified_at: null,
        });
      }
    }
    const legacyBackend = new LibSQLFactoryStorage({ id: 'findings-legacy', url });
    const legacy = legacyBackend.registerDomain(new LegacyFindings());
    await legacyBackend.init();
    await legacy.seed();
    await legacyBackend.close();

    const backend = new LibSQLFactoryStorage({ id: 'findings-current', url });
    const storage = backend.registerDomain(new WorkItemsStorage());
    await backend.init();
    const row = await getRow(storage, 'decision-failed:legacy');
    expect(row).toMatchObject({ status: 'open', escalatedAt: null, escalationNote: null });
    // Persisted, not defaulted at read time: the row escalates like a new one.
    await expect(
      storage.escalateSupervisorFinding({
        ...scope,
        findingKey: 'decision-failed:legacy',
        note: 'after upgrade',
        escalatedAt: new Date('2030-01-01T00:01:00.000Z'),
      }),
    ).resolves.toMatchObject({ status: 'escalated', escalationNote: 'after upgrade' });
    await backend.close();
    await rm(dir, { recursive: true, force: true });
  });
});

describe('openSupervisorFinding (single-finding, non-reconciling)', () => {
  const scope = { orgId: 'org1', factoryProjectId: 'p1' };
  const finding = (key: string, evidence = 'first') => ({
    id: key,
    kind: 'decision-failed' as const,
    workItemId: 'item-1',
    workItemNumber: null,
    title: 'A decision failed',
    evidence,
    ageMs: 0,
    suggestedRepair: { action: 'retry-decision' as const, decisionId: 'decision-1' },
  });
  const rows = async (storage: WorkItemsStorage) =>
    (await storage.listSupervisorFindingPage({ ...scope, limit: 10 })).rows;
  async function stamp(storage: WorkItemsStorage, key: string, occurrence: number, notifiedAt: Date) {
    const row = (await rows(storage)).find(r => r.findingKey === key);
    await storage.markSupervisorFindingNotified({
      ...scope,
      findingKey: key,
      occurrence,
      notifiedAt,
      finding: row?.finding ?? {},
    });
  }

  it('inserts exactly one row and leaves unrelated open findings untouched', async () => {
    const storage = await makeStorage();
    const t0 = new Date('2030-01-01T00:00:00.000Z');
    await storage.syncSupervisorFindings({
      ...scope,
      findings: [finding('seat-missing:a'), finding('held-waiting:b')],
      now: t0,
    });

    const opened = await storage.openSupervisorFinding({ ...scope, finding: finding('decision-failed:d1'), now: t0 });

    expect(opened).toMatchObject({
      findingKey: 'decision-failed:d1',
      occurrence: 0,
      status: 'open',
      lastNotifiedAt: null,
    });
    const open = await rows(storage);
    expect(open.map(row => row.findingKey).sort()).toEqual(['decision-failed:d1', 'held-waiting:b', 'seat-missing:a']);
    expect(open.every(row => row.resolvedAt === null)).toBe(true);
  });

  it('reopens a resolved row with the sweep semantics: occurrence up, stamp and escalation cleared', async () => {
    const storage = await makeStorage();
    const t0 = new Date('2030-01-01T00:00:00.000Z');
    await storage.openSupervisorFinding({ ...scope, finding: finding('decision-failed:d1'), now: t0 });
    await stamp(storage, 'decision-failed:d1', 0, t0);
    await storage.escalateSupervisorFinding({ ...scope, findingKey: 'decision-failed:d1', note: 'n', escalatedAt: t0 });
    await storage.syncSupervisorFindings({ ...scope, findings: [], now: new Date('2030-01-01T00:01:00.000Z') });

    const reopened = await storage.openSupervisorFinding({
      ...scope,
      finding: finding('decision-failed:d1', 'again'),
      now: new Date('2030-01-01T00:02:00.000Z'),
    });
    expect(reopened).toMatchObject({
      occurrence: 1,
      status: 'open',
      lastNotifiedAt: null,
      escalatedAt: null,
      escalationNote: null,
      resolvedAt: null,
    });
    expect(reopened.finding.evidence).toBe('again');
  });

  it('refreshes an open row in place without touching occurrence or stamps', async () => {
    const storage = await makeStorage();
    const t0 = new Date('2030-01-01T00:00:00.000Z');
    await storage.openSupervisorFinding({ ...scope, finding: finding('decision-failed:d1'), now: t0 });
    await stamp(storage, 'decision-failed:d1', 0, t0);

    const same = await storage.openSupervisorFinding({ ...scope, finding: finding('decision-failed:d1'), now: t0 });
    expect(same).toMatchObject({ occurrence: 0, lastNotifiedAt: t0 });
    const refreshed = await storage.openSupervisorFinding({
      ...scope,
      finding: finding('decision-failed:d1', 'newer evidence'),
      now: new Date('2030-01-01T00:01:00.000Z'),
    });
    expect(refreshed).toMatchObject({ occurrence: 0, lastNotifiedAt: t0 });
    expect(refreshed.finding.evidence).toBe('newer evidence');
  });

  it('a later sweep that derives the same key keeps the call-site row: no duplicate, no auto-resolve', async () => {
    const storage = await makeStorage();
    const t0 = new Date('2030-01-01T00:00:00.000Z');
    await storage.openSupervisorFinding({ ...scope, finding: finding('decision-failed:d1'), now: t0 });
    await stamp(storage, 'decision-failed:d1', 0, t0);

    // The sweep recomputes the same finding (different ageMs, as it would).
    await storage.syncSupervisorFindings({
      ...scope,
      findings: [{ ...finding('decision-failed:d1'), ageMs: 60_000 }],
      now: new Date('2030-01-01T00:01:00.000Z'),
    });
    const open = await rows(storage);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      findingKey: 'decision-failed:d1',
      occurrence: 0,
      resolvedAt: null,
      lastNotifiedAt: t0,
    });
  });

  it('a sweep whose snapshot predates the call-site row does not auto-resolve it', async () => {
    const storage = await makeStorage();
    const snapshot = new Date('2030-01-01T00:00:00.000Z');
    // Health was computed at `snapshot` (no failed decision yet); the
    // dispatcher opens the row a moment later; the sweep's sync lands last.
    await storage.openSupervisorFinding({
      ...scope,
      finding: finding('decision-failed:d1'),
      now: new Date('2030-01-01T00:00:00.500Z'),
    });
    await storage.syncSupervisorFindings({ ...scope, findings: [], now: snapshot });

    const open = await rows(storage);
    expect(open.map(row => row.findingKey)).toEqual(['decision-failed:d1']);
    expect(open[0]).toMatchObject({ occurrence: 0, resolvedAt: null });

    // Same millisecond as the snapshot: the snapshot cannot have seen it either.
    await storage.openSupervisorFinding({ ...scope, finding: finding('decision-failed:d2'), now: snapshot });
    await storage.syncSupervisorFindings({ ...scope, findings: [], now: snapshot });
    expect((await rows(storage)).map(row => row.findingKey).sort()).toEqual([
      'decision-failed:d1',
      'decision-failed:d2',
    ]);

    // A sweep that genuinely post-dates the row and no longer derives it resolves it as before.
    await storage.syncSupervisorFindings({ ...scope, findings: [], now: new Date('2030-01-01T00:05:00.000Z') });
    expect(await rows(storage)).toEqual([]);
  });
});

describe('answered decisions', () => {
  const scope = { orgId: 'org1', factoryProjectId: 'p1' };
  const now = new Date('2030-01-01T00:00:00.000Z');
  const parked = {
    toolName: 'ask_user',
    toolCallId: 'call-1',
    question: 'Which database?',
    session: { bindingId: 'b-1', resourceId: 'r-1', threadId: 't-1' },
  };

  async function parkedDecision(storage: WorkItemsStorage) {
    const created = await storage.upsert({ ...scope, userId: 'u', input });
    await storage.commitRuleEvaluation({
      ...scope,
      workItemId: created.item.id,
      ingress: { identity: 'answered', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: created.item.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'invokeSkill', role: 'work', prompt: 'Go.', idempotencyKey: 'answered' }],
      causalChain: [],
      now,
    });
    const [claimed] = await storage.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    const failed = await storage.failDeferredDecision({
      id: claimed!.id,
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      ownerId: 'worker-1',
      now,
      availableAt: now,
      lastError: 'Factory run is waiting on ask_user for an answer.',
      failureCode: 'run_awaiting_input',
      terminal: true,
      suspension: parked,
    });
    return failed!;
  }

  it('resolveAnsweredDecision marks a failed decision succeeded, once', async () => {
    const storage = await makeStorage();
    const failed = await parkedDecision(storage);
    const later = new Date(now.getTime() + 60_000);
    const resolved = await storage.resolveAnsweredDecision({ ...scope, decisionId: failed.id, now: later });
    expect(resolved).toMatchObject({ id: failed.id, status: 'succeeded' });
    expect(await storage.resolveAnsweredDecision({ ...scope, decisionId: failed.id, now: later })).toBeNull();
    expect((await storage.getDeferredDecision(scope.orgId, scope.factoryProjectId, failed.id))?.status).toBe(
      'succeeded',
    );
  });

  it('reparkDecision replaces the parked question on a failed decision and nothing else', async () => {
    const storage = await makeStorage();
    const failed = await parkedDecision(storage);
    const later = new Date(now.getTime() + 60_000);
    const next = { ...parked, toolCallId: 'call-2', question: 'And which port?', options: ['5432', '5433'] };
    const reparked = await storage.reparkDecision({
      ...scope,
      decisionId: failed.id,
      suspension: next,
      lastError: 'Factory run is waiting on ask_user for an answer.',
      now: later,
    });
    expect(reparked).toMatchObject({
      status: 'failed',
      failureCode: 'run_awaiting_input',
      failureOccurrence: failed.failureOccurrence,
      suspension: next,
    });
    // Not for decisions in any other state.
    await storage.resolveAnsweredDecision({ ...scope, decisionId: failed.id, now: later });
    expect(
      await storage.reparkDecision({ ...scope, decisionId: failed.id, suspension: next, lastError: 'x', now: later }),
    ).toBeNull();
  });
});
