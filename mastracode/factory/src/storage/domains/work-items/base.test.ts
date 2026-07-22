/**
 * Work-items domain over a real backend (libsql `:memory:`): external-source
 * dedup scoping and the atomic update path.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';

import { WorkItemRelationError, WorkItemsStorage } from './base.js';

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
    const originalInsertOne = backend.ops.insertOne.bind(backend.ops);
    vi.spyOn(backend.ops, 'insertOne').mockImplementation(async (collection, record) => {
      if (collection === 'work_items' && record.parent_work_item_id === parent.item.id) {
        childInsertReached.resolve();
        await releaseChildInsert.promise;
      }
      return originalInsertOne(collection, record);
    });

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
    const deleteMany = vi.spyOn(backend.ops, 'deleteMany');
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
    const originalUpdateAtomic = backend.ops.updateAtomic.bind(backend.ops);
    vi.spyOn(backend.ops, 'updateAtomic').mockImplementation(async (collection, where, updater) => {
      if (collection === 'work_items' && where.id === child.item.id) {
        childUpdateReached.resolve();
        await releaseChildUpdate.promise;
      }
      return originalUpdateAtomic(collection, where, updater);
    });

    const reparenting = storage.update({
      orgId: 'org1',
      id: child.item.id,
      userId: 'u',
      patch: { parentWorkItemId: parent.item.id },
    });
    await childUpdateReached.promise;
    const deleteMany = vi.spyOn(backend.ops, 'deleteMany');
    const deletion = storage.delete({ orgId: 'org1', id: parent.item.id });
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    expect(deleteMany).not.toHaveBeenCalled();
    releaseChildUpdate.resolve();
    await Promise.all([reparenting, deletion]);
    expect((await storage.get({ orgId: 'org1', id: child.item.id }))?.parentWorkItemId).toBeNull();
  });

  it('serializes relationship writes and deletion on the project lock', async () => {
    const backend = new LibSQLFactoryStorage({ id: 'work-items-lock-test', url: ':memory:' });
    const locks: string[] = [];
    backend.withDistributedLock = vi.fn(async (key, fn) => {
      locks.push(key);
      return fn();
    });
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

    expect(locks).toEqual(['work-items:org1:p1', 'work-items:org1:p1', 'work-items:org1:p1']);
  });

  it('resolves exact tenant-scoped binding history after a run is revoked', async () => {
    const storage = await makeStorage();
    const address = {
      orgId: 'org1',
      factoryProjectId: 'p1',
      threadId: 'thread:/opaque?value=1',
      resourceId: 'resource-1',
      sessionId: 'session-1',
    };
    const prepared = await storage.prepareRunStart({
      orgId: address.orgId,
      userId: 'u',
      factoryProjectId: address.factoryProjectId,
      workItem: { input },
      role: 'work',
      session: { sessionId: address.sessionId, branch: 'feature/one', threadId: address.threadId },
      resourceId: address.resourceId,
      kickoffKey: 'kickoff-1',
      kickoffMessage: null,
    });

    await expect(storage.findRunBinding(address)).resolves.toMatchObject({
      status: 'match',
      binding: {
        id: prepared.binding.id,
        workItemId: prepared.item.id,
        status: 'active',
      },
    });
    await expect(storage.findRunBinding({ ...address, orgId: 'org2' })).resolves.toEqual({ status: 'none' });
    await expect(storage.findRunBinding({ ...address, sessionId: 'other-session' })).resolves.toEqual({
      status: 'none',
    });

    await storage.revokeRunBinding({
      orgId: address.orgId,
      factoryProjectId: address.factoryProjectId,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });

    await expect(storage.findActiveRunBinding(address)).resolves.toBeNull();
    await expect(storage.findRunBinding(address)).resolves.toMatchObject({
      status: 'match',
      binding: {
        id: prepared.binding.id,
        status: 'revoked',
      },
    });
  });

  it('fails closed when multiple active runs share one exact session address', async () => {
    const storage = await makeStorage();
    const address = {
      orgId: 'org1',
      factoryProjectId: 'p1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      sessionId: 'session-1',
    };
    await storage.prepareRunStart({
      orgId: address.orgId,
      userId: 'u',
      factoryProjectId: address.factoryProjectId,
      workItem: { input },
      role: 'work',
      session: { sessionId: address.sessionId, branch: 'feature/one', threadId: address.threadId },
      resourceId: address.resourceId,
      kickoffKey: 'kickoff-1',
      kickoffMessage: null,
    });
    await storage.prepareRunStart({
      orgId: address.orgId,
      userId: 'u',
      factoryProjectId: address.factoryProjectId,
      workItem: {
        input: {
          ...input,
          externalSource: { integrationId: 'github', type: 'issue', externalId: '43' },
        },
      },
      role: 'work',
      session: { sessionId: address.sessionId, branch: 'feature/two', threadId: address.threadId },
      resourceId: address.resourceId,
      kickoffKey: 'kickoff-2',
      kickoffMessage: null,
    });

    await expect(storage.findRunBinding(address)).resolves.toEqual({ status: 'ambiguous-active' });
    await expect(storage.findActiveRunBinding(address)).resolves.toBeNull();
    await expect(storage.listActiveRunBindings()).resolves.toEqual([]);
    await expect(
      storage.findRunBindingBySession({
        factoryProjectId: address.factoryProjectId,
        threadId: address.threadId,
        resourceId: address.resourceId,
        sessionId: address.sessionId,
      }),
    ).resolves.toBeNull();
  });
});
