/**
 * Work-items domain over a real backend (libsql `:memory:`): external-source
 * dedup scoping and the atomic update path.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';

import { applyStageTransition, isAgentActor, WorkItemRelationError, WorkItemsStorage } from './base.js';
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
      decisionId: failed.id,
      failureOccurrence: failed.failureOccurrence,
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
        decisionId: failed.id,
        failureOccurrence: failed.failureOccurrence,
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
