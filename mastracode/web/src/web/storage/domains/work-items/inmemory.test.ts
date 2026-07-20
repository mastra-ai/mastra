import { describe, expect, it } from 'vitest';

import { WorkItemsStorageInMemory } from './inmemory';

const input = {
  source: 'github-issue' as const,
  sourceKey: 'github-issue:42',
  title: 'Fix login',
  url: null,
  stages: ['intake'],
  sessions: {},
  metadata: {},
};

describe('WorkItemsStorageInMemory', () => {
  it('deduplicates source keys within an org, not across orgs', async () => {
    const storage = new WorkItemsStorageInMemory();

    const first = await storage.upsert({ orgId: 'org1', userId: 'user1', githubProjectId: 'project1', input });
    const otherOrg = await storage.upsert({ orgId: 'org2', userId: 'user2', githubProjectId: 'project1', input });
    const reused = await storage.upsert({
      orgId: 'org1',
      userId: 'user3',
      githubProjectId: 'project1',
      input: { ...input, title: 'Updated title' },
    });

    expect(first.created).toBe(true);
    expect(otherOrg.created).toBe(true);
    expect(otherOrg.item.id).not.toBe(first.item.id);
    expect(reused.created).toBe(false);
    expect(reused.item.id).toBe(first.item.id);
  });
});
