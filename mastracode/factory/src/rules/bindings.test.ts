import { describe, expect, it } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { BLOCKED_START_STALE_MS } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function prepareBinding(storage: WorkItemsStorage, kickoffStatus?: 'pending' | 'blocked') {
  return storage.prepareRunStart({
    ...(kickoffStatus ? { kickoffStatus } : {}),
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:1',
        },
        title: 'Issue',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'work',
    session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-1',
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
});

describe('Blocked pending starts', () => {
  const claimInput = (now = new Date()) => ({
    ownerId: 'dispatcher-1',
    now,
    leaseExpiresAt: new Date(now.getTime() + 30_000),
    limit: 10,
  });

  it('keeps blocked kickoffs invisible to the dispatcher until released', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage, 'blocked');
    expect(prepared.pendingStart.status).toBe('blocked');

    await expect(storage.claimPendingStarts(claimInput())).resolves.toEqual([]);

    const released = await storage.releasePendingStart({
      id: prepared.pendingStart.id,
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      message: 'kickoff resolved late',
    });
    expect(released).toMatchObject({ status: 'pending', message: 'kickoff resolved late' });

    const claimed = await storage.claimPendingStarts(claimInput());
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ id: prepared.pendingStart.id, status: 'leased' });
  });

  it('releases only blocked rows and leaves the stored message without an override', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage, 'blocked');

    const released = await storage.releasePendingStart({
      id: prepared.pendingStart.id,
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
    });
    expect(released).toMatchObject({ status: 'pending', message: null });

    // Already released — a second release (or releasing a claimed row) is a no-op.
    await expect(
      storage.releasePendingStart({ id: prepared.pendingStart.id, orgId: 'org-1', factoryProjectId: PROJECT_ID }),
    ).resolves.toBeNull();
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('pending');
  });

  it('scopes release to the exact tenant and project', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage, 'blocked');

    await expect(
      storage.releasePendingStart({ id: prepared.pendingStart.id, orgId: 'other-org', factoryProjectId: PROJECT_ID }),
    ).resolves.toBeNull();
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('blocked');
  });

  it('fails blocked kickoffs that outlive the staleness window', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage, 'blocked');

    // Just inside the window — stays gated.
    const fresh = new Date(Date.now() + BLOCKED_START_STALE_MS - 60_000);
    await expect(storage.claimPendingStarts(claimInput(fresh))).resolves.toEqual([]);
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('blocked');

    // Past the window (server died mid-finalize) — surfaced as failed.
    const stale = new Date(Date.now() + BLOCKED_START_STALE_MS + 60_000);
    await expect(storage.claimPendingStarts(claimInput(stale))).resolves.toEqual([]);
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]).toMatchObject({
      id: prepared.pendingStart.id,
      status: 'failed',
      lastError: expect.stringContaining('blocked kickoff went stale'),
    });
  });
});
