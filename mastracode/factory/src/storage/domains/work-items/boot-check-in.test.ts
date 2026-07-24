import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';
import type { WorkItemStage, WorkItemsStorage } from './base.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_PROJECT_ID = '99999999-2222-4333-8444-555555555555';

async function seedItem(
  storage: WorkItemsStorage,
  input: {
    title: string;
    stages: WorkItemStage[];
    externalId: string;
    orgId?: string;
    factoryProjectId?: string;
    sessions?: Record<string, { sessionId: string; branch: string; threadId: string }>;
  },
) {
  return (
    await storage.upsert({
      orgId: input.orgId ?? 'org-1',
      userId: 'user-1',
      factoryProjectId: input.factoryProjectId ?? PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: input.externalId },
        title: input.title,
        stages: input.stages,
        ...(input.sessions ? { sessions: input.sessions } : {}),
        metadata: {},
      },
    })
  ).item;
}

describe('WorkItemsStorage boot check-in', () => {
  it('reports only tenants that still have non-terminal work', async () => {
    const seed = await createFactoryStorageForTests();
    await seedItem(seed.workItems, { title: 'Open', stages: ['execute'], externalId: '1' });
    await seedItem(seed.workItems, { title: 'Shipped', stages: ['done'], externalId: '2' });
    await seedItem(seed.workItems, { title: 'Dropped', stages: ['canceled'], externalId: '3' });
    await seedItem(seed.workItems, {
      title: 'Another org',
      stages: ['review'],
      externalId: '4',
      orgId: 'org-2',
      factoryProjectId: OTHER_PROJECT_ID,
    });

    const tenants = await seed.workItems.listTenantsWithOpenWorkItems();

    expect(tenants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orgId: 'org-1', factoryProjectId: PROJECT_ID, openItemCount: 1 }),
        expect.objectContaining({ orgId: 'org-2', factoryProjectId: OTHER_PROJECT_ID, openItemCount: 1 }),
      ]),
    );
    expect(tenants).toHaveLength(2);
  });

  it('reports nothing once every item reached a terminal stage', async () => {
    const seed = await createFactoryStorageForTests();
    await seedItem(seed.workItems, { title: 'Shipped', stages: ['done'], externalId: '1' });
    await seedItem(seed.workItems, { title: 'Dropped', stages: ['canceled'], externalId: '2' });

    await expect(seed.workItems.listTenantsWithOpenWorkItems()).resolves.toEqual([]);
  });

  it('resolves a supervisor user from the run owner, falling back to the item creator', async () => {
    const seed = await createFactoryStorageForTests();
    await seedItem(seed.workItems, { title: 'No sessions', stages: ['intake'], externalId: '1' });
    await seedItem(seed.workItems, {
      title: 'Bound',
      stages: ['execute'],
      externalId: '2',
      orgId: 'org-2',
      factoryProjectId: OTHER_PROJECT_ID,
      sessions: { work: { sessionId: 'session-1', branch: 'factory/bound', threadId: 'thread-1' } },
    });

    const tenants = await seed.workItems.listTenantsWithOpenWorkItems();

    expect(tenants.every(tenant => tenant.supervisorUserId === 'user-1')).toBe(true);
  });

  it('accepts one boot check-in per bucket and rejects the rest of the storm', async () => {
    const seed = await createFactoryStorageForTests();
    const input = {
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      supervisorUserId: 'user-1',
      reason: 'restarted',
      summary: 'The Factory server restarted.',
      now: new Date('2030-01-01T00:00:00.000Z'),
    };

    const first = await seed.workItems.createBootCheckInNotification({ ...input, bucketKey: 'bucket-1' });
    const replay = await seed.workItems.createBootCheckInNotification({ ...input, bucketKey: 'bucket-1' });
    const nextWindow = await seed.workItems.createBootCheckInNotification({ ...input, bucketKey: 'bucket-2' });

    expect(first).toMatchObject({
      event: 'boot_check_in',
      status: 'pending',
      supervisorUserId: 'user-1',
      idempotencyKey: 'boot_check_in:bucket-1',
      approvalId: null,
      workItemId: null,
      requestedStage: null,
      expectedRevision: null,
      approvalStatus: null,
    });
    expect(replay).toBeNull();
    expect(nextWindow).not.toBeNull();
    expect((await seed.workItems.listSupervisorNotifications('org-1', PROJECT_ID)).map(r => r.idempotencyKey)).toEqual([
      'boot_check_in:bucket-1',
      'boot_check_in:bucket-2',
    ]);
  });

  it('scopes the boot check-in dedupe per tenant', async () => {
    const seed = await createFactoryStorageForTests();
    const input = {
      supervisorUserId: 'user-1',
      bucketKey: 'bucket-1',
      reason: 'restarted',
      summary: 'The Factory server restarted.',
      now: new Date('2030-01-01T00:00:00.000Z'),
    };

    const first = await seed.workItems.createBootCheckInNotification({
      ...input,
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
    });
    const otherTenant = await seed.workItems.createBootCheckInNotification({
      ...input,
      orgId: 'org-2',
      factoryProjectId: OTHER_PROJECT_ID,
    });

    expect(first).not.toBeNull();
    expect(otherTenant).not.toBeNull();
    expect(await seed.workItems.listSupervisorNotifications('org-2', PROJECT_ID)).toEqual([]);
  });

  it('hands the boot check-in to the dispatcher lease loop like any other notification', async () => {
    const seed = await createFactoryStorageForTests();
    const created = await seed.workItems.createBootCheckInNotification({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      supervisorUserId: 'user-1',
      bucketKey: 'bucket-1',
      reason: 'restarted',
      summary: 'The Factory server restarted.',
      now: new Date('2030-01-01T00:00:00.000Z'),
    });

    const claimed = await seed.workItems.claimSupervisorNotifications({
      ownerId: 'dispatcher-1',
      limit: 10,
      now: new Date('2030-01-01T00:00:01.000Z'),
      leaseExpiresAt: new Date('2030-01-01T00:05:00.000Z'),
    });

    expect(claimed.map(record => record.id)).toEqual([created!.id]);
    expect(claimed[0]).toMatchObject({ event: 'boot_check_in', status: 'leased' });
  });
});
