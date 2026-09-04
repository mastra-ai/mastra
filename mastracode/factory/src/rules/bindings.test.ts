import { describe, expect, it } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function prepareBinding(storage: WorkItemsStorage, options: { issue?: number; kickoffKey?: string } = {}) {
  const issue = options.issue ?? 1;
  return storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: `github-issue:${issue}`,
        },
        title: `Issue ${issue}`,
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'work',
    session: { sessionId: 'session-1', branch: `factory/issue-${issue}`, threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: options.kickoffKey ?? 'kickoff-1',
    kickoffMessage: null,
  });
}

describe('Factory run binding authority', () => {
  it('replays concurrent preparation for the same kickoff', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;

    const [first, second] = await Promise.all([prepareBinding(storage), prepareBinding(storage)]);

    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    expect(second.binding.id).toBe(first.binding.id);
    expect(second.pendingStart.id).toBe(first.pendingStart.id);
  });

  it('keeps only the newest active binding for an exact session address', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const first = await prepareBinding(storage);
    const second = await prepareBinding(storage, { issue: 2, kickoffKey: 'kickoff-2' });
    const address = {
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      threadId: 'thread-1',
      resourceId: 'resource-1',
      sessionId: 'session-1',
    };

    await expect(storage.findActiveRunBinding(address)).resolves.toMatchObject({
      id: second.binding.id,
      workItemId: second.item.id,
    });
    await expect(storage.listRunBindings('org-1', PROJECT_ID)).resolves.toEqual([
      expect.objectContaining({ id: first.binding.id, status: 'revoked' }),
      expect.objectContaining({ id: second.binding.id, status: 'active' }),
    ]);
  });

  it('requires the complete tenant, project, thread, resource, and session tuple', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);
    const exact = {
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      threadId: 'thread-1',
      resourceId: 'resource-1',
      sessionId: 'session-1',
    };

    await expect(storage.findActiveRunBinding(exact)).resolves.toMatchObject({ id: prepared.binding.id });
    for (const mismatch of [
      { orgId: 'other-org' },
      { factoryProjectId: '22222222-2222-4222-8222-222222222222' },
      { threadId: 'other-thread' },
      { resourceId: 'other-resource' },
      { sessionId: 'other-session' },
    ]) {
      await expect(storage.findActiveRunBinding({ ...exact, ...mismatch })).resolves.toBeNull();
    }
  });

  it('revokes only the exact tenant-scoped binding and removes its authority immediately', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);
    const exact = {
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      threadId: 'thread-1',
      resourceId: 'resource-1',
      sessionId: 'session-1',
    };

    await expect(
      storage.revokeRunBinding({
        orgId: 'other-org',
        factoryProjectId: PROJECT_ID,
        bindingId: prepared.binding.id,
        revokedAt: new Date(),
      }),
    ).resolves.toBeNull();
    await expect(storage.findActiveRunBinding(exact)).resolves.toMatchObject({ id: prepared.binding.id });

    const revokedAt = new Date('2026-07-18T10:00:00Z');
    await expect(
      storage.revokeRunBinding({
        orgId: 'org-1',
        factoryProjectId: PROJECT_ID,
        bindingId: prepared.binding.id,
        revokedAt,
      }),
    ).resolves.toMatchObject({ status: 'revoked', revokedAt });
    await expect(storage.findActiveRunBinding(exact)).resolves.toBeNull();
  });

  it('revokes only the tenant-scoped active bindings for one work item', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);
    const revokedAt = new Date('2026-07-18T10:00:00Z');

    await expect(
      storage.revokeRunBindingsForWorkItem({
        orgId: 'other-org',
        factoryProjectId: PROJECT_ID,
        workItemId: prepared.item.id,
        revokedAt,
      }),
    ).resolves.toBe(0);

    await expect(
      storage.revokeRunBindingsForWorkItem({
        orgId: 'org-1',
        factoryProjectId: PROJECT_ID,
        workItemId: prepared.item.id,
        revokedAt,
      }),
    ).resolves.toBe(1);
    await expect(storage.listRunBindings('org-1', PROJECT_ID, prepared.item.id)).resolves.toEqual([
      expect.objectContaining({ id: prepared.binding.id, status: 'revoked', revokedAt }),
    ]);

    // Idempotent: already-revoked bindings are not touched again.
    await expect(
      storage.revokeRunBindingsForWorkItem({
        orgId: 'org-1',
        factoryProjectId: PROJECT_ID,
        workItemId: prepared.item.id,
        revokedAt: new Date(),
      }),
    ).resolves.toBe(0);
  });

  describe('revokeStaleRunBindings', () => {
    it('revokes bindings older than the cutoff and keeps fresh ones', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const prepared = await prepareBinding(storage);

      await expect(
        storage.revokeStaleRunBindings({ olderThan: new Date(Date.now() - 60_000), now: new Date() }),
      ).resolves.toBe(0);
      await expect(storage.listRunBindings('org-1', PROJECT_ID, prepared.item.id)).resolves.toEqual([
        expect.objectContaining({ status: 'active' }),
      ]);

      await expect(
        storage.revokeStaleRunBindings({ olderThan: new Date(Date.now() + 60_000), now: new Date() }),
      ).resolves.toBe(1);
      await expect(storage.listRunBindings('org-1', PROJECT_ID, prepared.item.id)).resolves.toEqual([
        expect.objectContaining({ status: 'revoked' }),
      ]);
    });

    it('revokes fresh bindings whose work item reached a terminal stage', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const prepared = await prepareBinding(storage);
      await storage.update({
        orgId: 'org-1',
        id: prepared.item.id,
        userId: 'user-1',
        patch: { stages: ['done'] },
      });

      await expect(
        storage.revokeStaleRunBindings({ olderThan: new Date(Date.now() - 60_000), now: new Date() }),
      ).resolves.toBe(1);
    });

    it('revokes fresh bindings whose work item is missing', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const prepared = await prepareBinding(storage);
      await storage.delete({ orgId: 'org-1', id: prepared.item.id });

      await expect(
        storage.revokeStaleRunBindings({ olderThan: new Date(Date.now() - 60_000), now: new Date() }),
      ).resolves.toBe(1);
      await expect(storage.listActiveRunBindings()).resolves.toEqual([]);
    });
  });
});
