import { describe, expect, it } from 'vitest';

import type { WorkItemsStorage } from '../../storage/domains/work-items/base';
import { seedFactoryStorageForTests } from '../../storage/test-utils';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function prepareBinding(storage: WorkItemsStorage) {
  return storage.prepareRunStart({
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
    session: { projectPath: '/worktree', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: null,
  });
}

describe('Factory run binding authority', () => {
  it('requires the complete tenant, project, thread, resource, and scope tuple', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);
    const exact = {
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      threadId: 'thread-1',
      resourceId: 'resource-1',
      projectPath: '/worktree',
    };

    await expect(storage.findActiveRunBinding(exact)).resolves.toMatchObject({ id: prepared.binding.id });
    for (const mismatch of [
      { orgId: 'other-org' },
      { factoryProjectId: '22222222-2222-4222-8222-222222222222' },
      { threadId: 'other-thread' },
      { resourceId: 'other-resource' },
      { projectPath: '/other-worktree' },
    ]) {
      await expect(storage.findActiveRunBinding({ ...exact, ...mismatch })).resolves.toBeNull();
    }
  });

  it('revokes only the exact tenant-scoped binding and removes its authority immediately', async () => {
    const storage = (await seedFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);
    const exact = {
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      threadId: 'thread-1',
      resourceId: 'resource-1',
      projectPath: '/worktree',
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
